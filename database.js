const { getStore } = require("@netlify/blobs");

const store = getStore("orbit-db");

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(data),
  };
}

async function readList(key) {
  const value = await store.get(key, { type: "json" });
  return Array.isArray(value) ? value : [];
}

async function writeList(key, value) {
  await store.setJSON(key, value);
}

function cleanEmail(email) {
  return String(email || "").trim().toLowerCase();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Sadece POST desteklenir." });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const action = String(body.action || "");

    if (action === "users:get") {
      const email = cleanEmail(body.email);
      const users = await readList("users");
      const user = users.find((item) => cleanEmail(item.email) === email);
      if (!user) return json(404, { message: "Kullanıcı bulunamadı." });
      return json(200, { user });
    }

    if (action === "users:list") {
      return json(200, { users: await readList("users") });
    }

    if (action === "users:save") {
      const user = { ...(body.user || {}) };
      user.email = cleanEmail(user.email);
      if (!user.email.includes("@")) return json(400, { message: "Geçerli e-posta gir." });
      const users = await readList("users");
      const index = users.findIndex((item) => cleanEmail(item.email) === user.email);
      if (index >= 0) users[index] = { ...users[index], ...user };
      else users.push(user);
      await writeList("users", users);
      return json(200, { user: users[index >= 0 ? index : users.length - 1], message: "Kullanıcı kaydedildi." });
    }

    if (action === "users:delete") {
      const email = cleanEmail(body.email);
      const users = await readList("users");
      const nextUsers = users.filter((item) => cleanEmail(item.email) !== email);
      await writeList("users", nextUsers);
      const posts = await readList("posts");
      await writeList("posts", posts.filter((item) => cleanEmail(item.authorEmail) !== email));
      return json(200, { deleted: nextUsers.length !== users.length, message: nextUsers.length !== users.length ? "Hesap silindi." : "Kullanıcı bulunamadı." });
    }

    if (action === "posts:list") {
      const email = cleanEmail(body.email);
      const posts = await readList("posts");
      return json(200, { posts: email ? posts.filter((item) => cleanEmail(item.authorEmail) === email) : posts });
    }

    if (action === "posts:save") {
      const post = { ...(body.post || {}) };
      if (!post.id || !post.authorEmail) return json(400, { message: "Gönderi id veya kullanıcı e-postası eksik." });
      const posts = await readList("posts");
      const index = posts.findIndex((item) => String(item.id) === String(post.id));
      if (index >= 0) posts[index] = post;
      else posts.push(post);
      await writeList("posts", posts);
      return json(200, { post, message: "Gönderi kaydedildi." });
    }

    return json(404, { message: "Veri tabanı endpointi bulunamadı." });
  } catch (error) {
    return json(500, { message: error.message || "Veri tabanı hatası." });
  }
};
