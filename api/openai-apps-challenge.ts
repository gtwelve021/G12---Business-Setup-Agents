export default function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  res.setHeader("content-type", "text/plain");
  res.send("4NaThDDj5XKI22MD8xtNTHVc0ysvLsXvEo18fuSQFhY");
}
