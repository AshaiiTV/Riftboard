import fs from "node:fs/promises";
import path from "node:path";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const templatePath = process.argv[2] || "docs/discord/nxt5-discord-template.json";

if (!token || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID.");
  process.exit(1);
}

const API = "https://discord.com/api/v10";
const CHANNEL_TYPES = {
  text: 0,
  voice: 2,
  category: 4,
  announcement: 5,
  forum: 15,
};

async function discord(method, endpoint, body) {
  const response = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} failed: ${response.status} ${text}`);
  }
  return data;
}

function intColor(hex) {
  return Number.parseInt(String(hex || "#000000").replace("#", ""), 16);
}

async function main() {
  const raw = await fs.readFile(path.resolve(templatePath), "utf8");
  const template = JSON.parse(raw);
  const roleIds = new Map();

  console.log(`Importing template: ${template.name}`);

  for (const role of template.roles || []) {
    const created = await discord("POST", `/guilds/${guildId}/roles`, {
      name: role.name,
      color: intColor(role.color),
      hoist: Boolean(role.hoist),
      mentionable: false,
    });
    roleIds.set(role.name, created.id);
    console.log(`Role created: ${role.name}`);
  }

  for (const category of template.categories || []) {
    const overwrites = [];
    if (category.private) {
      overwrites.push({
        id: guildId,
        type: 0,
        deny: "1024",
      });
      for (const roleName of category.allowedRoles || []) {
        const id = roleIds.get(roleName);
        if (id) overwrites.push({ id, type: 0, allow: "1024" });
      }
    }

    const parent = await discord("POST", `/guilds/${guildId}/channels`, {
      name: category.name,
      type: CHANNEL_TYPES.category,
      permission_overwrites: overwrites,
    });
    console.log(`Category created: ${category.name}`);

    for (const channel of category.channels || []) {
      const payload = {
        name: channel.name,
        type: CHANNEL_TYPES[channel.type] ?? CHANNEL_TYPES.text,
        parent_id: parent.id,
        topic: channel.topic || undefined,
      };
      if (channel.type === "forum" && Array.isArray(channel.tags)) {
        payload.available_tags = channel.tags.map((name) => ({ name, moderated: false }));
      }
      const created = await discord("POST", `/guilds/${guildId}/channels`, payload);
      console.log(`Channel created: ${category.name} / ${channel.name}`);

      if (channel.message && channel.type === "text") {
        await discord("POST", `/channels/${created.id}/messages`, { content: channel.message });
        console.log(`Message posted: ${channel.name}`);
      }
    }
  }

  console.log("Done. Create the official Discord template from Server Settings > Server Template.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
