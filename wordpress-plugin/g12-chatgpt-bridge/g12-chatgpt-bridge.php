<?php
/**
 * Plugin Name: G12 ChatGPT Bridge
 * Description: REST bridge for the G12 ChatGPT App lead capture flow.
 * Version: 0.2.0
 * Author: G12
 */

if (!defined('ABSPATH')) {
    exit;
}

const G12_CHATGPT_BRIDGE_OPTION = 'g12_chatgpt_bridge_secret';

add_action('admin_menu', function () {
    add_options_page(
        'G12 ChatGPT Bridge',
        'G12 ChatGPT Bridge',
        'manage_options',
        'g12-chatgpt-bridge',
        'g12_chatgpt_bridge_settings_page'
    );
});

add_action('admin_init', function () {
    register_setting('g12_chatgpt_bridge', G12_CHATGPT_BRIDGE_OPTION, [
        'type' => 'string',
        'sanitize_callback' => 'sanitize_text_field',
        'default' => '',
    ]);
});

function g12_chatgpt_bridge_settings_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    ?>
    <div class="wrap">
        <h1>G12 ChatGPT Bridge</h1>
        <form method="post" action="options.php">
            <?php settings_fields('g12_chatgpt_bridge'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="g12-chatgpt-secret">Lead API Secret</label></th>
                    <td>
                        <input
                            id="g12-chatgpt-secret"
                            name="<?php echo esc_attr(G12_CHATGPT_BRIDGE_OPTION); ?>"
                            type="password"
                            class="regular-text"
                            value="<?php echo esc_attr(get_option(G12_CHATGPT_BRIDGE_OPTION, '')); ?>"
                            autocomplete="new-password"
                        />
                        <p class="description">Use the same value in the MCP app as G12_LEAD_SECRET.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

add_action('rest_api_init', function () {
    register_rest_route('g12-chatgpt/v1', '/leads', [
        'methods' => 'POST',
        'callback' => 'g12_chatgpt_bridge_create_lead',
        'permission_callback' => 'g12_chatgpt_bridge_authorize',
        'args' => [
            'name' => ['required' => true, 'type' => 'string'],
            'message' => ['required' => true, 'type' => 'string'],
            'email' => ['required' => false, 'type' => 'string'],
            'phone' => ['required' => false, 'type' => 'string'],
            'service' => ['required' => false, 'type' => 'string'],
            'preferredContact' => ['required' => false, 'type' => 'string'],
            'consent' => ['required' => true, 'type' => 'boolean'],
            'idempotencyKey' => ['required' => true, 'type' => 'string'],
        ],
    ]);
});

function g12_chatgpt_bridge_authorize(WP_REST_Request $request)
{
    $secret = get_option(G12_CHATGPT_BRIDGE_OPTION, '');
    if (!$secret) {
        return new WP_Error('g12_chatgpt_not_configured', 'Bridge secret is not configured.', ['status' => 503]);
    }

    $header = $request->get_header('authorization');
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        return new WP_Error('g12_chatgpt_missing_token', 'Missing bearer token.', ['status' => 401]);
    }

    if (!hash_equals($secret, trim($matches[1]))) {
        return new WP_Error('g12_chatgpt_bad_token', 'Invalid bearer token.', ['status' => 403]);
    }

    return true;
}

function g12_chatgpt_bridge_create_lead(WP_REST_Request $request)
{
    $params = $request->get_json_params();
    $name = sanitize_text_field($params['name'] ?? '');
    $email = sanitize_email($params['email'] ?? '');
    $phone = sanitize_text_field($params['phone'] ?? '');
    $service = sanitize_text_field($params['service'] ?? '');
    $preferred_contact = sanitize_text_field($params['preferredContact'] ?? '');
    $message = sanitize_textarea_field($params['message'] ?? '');
    $consent = rest_sanitize_boolean($params['consent'] ?? false);
    $idempotency_key = sanitize_text_field($params['idempotencyKey'] ?? '');

    if (!$name || !$message || (!$email && !$phone) || !$consent || !preg_match('/^[a-f0-9]{64}$/', $idempotency_key)) {
        return new WP_Error(
            'g12_chatgpt_invalid_lead',
            'Name, message, contact method, consent, and a valid idempotency key are required.',
            ['status' => 400]
        );
    }

    $existing = get_posts([
        'post_type' => 'post',
        'post_status' => 'private',
        'meta_key' => '_g12_chatgpt_idempotency_key',
        'meta_value' => $idempotency_key,
        'fields' => 'ids',
        'posts_per_page' => 1,
        'no_found_rows' => true,
    ]);

    if ($existing) {
        return [
            'ok' => true,
            'lead_id' => (int) $existing[0],
            'duplicate' => true,
            'message' => 'Lead already exists in WordPress.',
        ];
    }

    $post_id = wp_insert_post([
        'post_type' => 'post',
        'post_status' => 'private',
        'post_title' => sprintf('ChatGPT Lead - %s - %s', $name, current_time('Y-m-d H:i')),
        'post_content' => implode("\n", array_filter([
            'Name: ' . $name,
            $email ? 'Email: ' . $email : '',
            $phone ? 'Phone: ' . $phone : '',
            $service ? 'Service: ' . $service : '',
            $preferred_contact ? 'Preferred Contact: ' . $preferred_contact : '',
            'Message: ' . $message,
            'Consent: User explicitly requested contact and approved storage of these details.',
            'Source: ChatGPT App',
        ])),
        'meta_input' => [
            '_g12_chatgpt_lead' => '1',
            '_g12_chatgpt_email' => $email,
            '_g12_chatgpt_phone' => $phone,
            '_g12_chatgpt_service' => $service,
            '_g12_chatgpt_preferred_contact' => $preferred_contact,
            '_g12_chatgpt_consent_at' => current_time('mysql', true),
            '_g12_chatgpt_idempotency_key' => $idempotency_key,
        ],
    ], true);

    if (is_wp_error($post_id)) {
        return $post_id;
    }

    $admin_email = get_option('admin_email');
    if ($admin_email) {
        wp_mail($admin_email, 'New G12 ChatGPT App Lead', get_post_field('post_content', $post_id));
    }

    return [
        'ok' => true,
        'lead_id' => $post_id,
        'duplicate' => false,
        'message' => 'Lead saved in WordPress.',
    ];
}
