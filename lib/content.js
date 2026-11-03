const SITE_URL = "https://lyphucthien.vercel.app";
const DISCORD = "https://discord.gg/gyZ27Hw9qu";
const LOGO = "https://res.cloudinary.com/dkui88bcf/image/upload/v1786939501/Logo_LPT_vnq390.png";

const TITLE = "Free keys for Minecraft and LPT Hub";
const LEAD = "Complete one short link and get your key right away. One key works for both the Minecraft server and the LPT Hub script. Free, no account needed.";

const STEPS = [
  { title: "Pick a link", text: "Work.ink, Link 4m or Link 4 Sub. Any of them works." },
  { title: "Finish the link", text: "When you finish, you are sent back to the key page automatically." },
  { title: "Copy and use your key", text: "Paste it into the server or script. Each device gets 1 key every 3 hours." }
];

const ABOUT = "LPT Hub is a free key system for a Minecraft server and the LPT Hub script. This site issues a key after you complete a short link, and lists the supported games along with each game's features.";

const FAQ = [
  { q: "How long does a key last?", a: "Each device gets 1 key every 3 hours. For the LPT Hub script, a key is tied to one device and expires 3 hours after its first use." },
  { q: "What can one key be used for?", a: "One key works for both the Minecraft server and the LPT Hub script. You do not need a separate key for each." },
  { q: "Why do I have to complete a short link?", a: "Short links (Work.ink, Link 4m, Link 4 Sub) help keep the project free. You must finish the link to be sent back to the key page." },
  { q: "I finished but I don't see a key. What now?", a: "Try again from the start and don't leave halfway. If it still fails, message us on the LPT Hub Discord for help." }
];

const PAGES = [
  { path: "/", title: "Home" },
  { path: "/get-key", title: "Get key" },
  { path: "/games", title: "Supported games" },
  { path: "/docs", title: "API and MCP docs" },
  { path: "/about", title: "About" },
  { path: "/contact", title: "Contact" },
  { path: "/privacy", title: "Privacy" }
];

module.exports = { SITE_URL, DISCORD, LOGO, TITLE, LEAD, STEPS, ABOUT, FAQ, PAGES };
