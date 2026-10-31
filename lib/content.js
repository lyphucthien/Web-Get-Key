const SITE_URL = "https://lyphucthien.vercel.app";
const DISCORD = "https://discord.gg/gyZ27Hw9qu";
const LOGO = "https://res.cloudinary.com/dkui88bcf/image/upload/v1786939501/Logo_LPT_vnq390.png";

const TITLE = "Key miễn phí cho Minecraft và LPT Hub";
const LEAD = "Hoàn thành một link rút gọn là nhận key dùng ngay. Một key dùng được cho cả server Minecraft và script LPT Hub. Miễn phí, không cần tài khoản.";

const STEPS = [
  { title: "Chọn một link", text: "Work.ink, Link 4m hoặc Link 4 Sub, chọn cái nào cũng được." },
  { title: "Làm đến hết link", text: "Hoàn thành xong sẽ tự quay về trang lấy key." },
  { title: "Copy và dùng key", text: "Dán vào server hoặc script. Mỗi thiết bị nhận 1 key sau mỗi 3 giờ." }
];

const ABOUT = "LPT Hub là hệ thống key miễn phí cho server Minecraft và script LPT Hub. Trang này cấp key sau khi bạn hoàn thành một link rút gọn, đồng thời liệt kê các game được hỗ trợ cùng chức năng của từng game.";

const FAQ = [
  { q: "Key dùng được trong bao lâu?", a: "Mỗi thiết bị nhận 1 key sau mỗi 3 giờ. Với script LPT Hub, key gắn với một thiết bị và hết hạn sau 3 giờ kể từ lần dùng đầu tiên." },
  { q: "Một key dùng được cho những gì?", a: "Một key dùng được cho cả server Minecraft và script LPT Hub, không cần lấy key riêng cho từng nơi." },
  { q: "Vì sao phải làm link rút gọn?", a: "Các link rút gọn (Work.ink, Link 4m, Link 4 Sub) giúp dự án duy trì miễn phí. Bạn cần làm đến hết link để được đưa về trang lấy key." },
  { q: "Làm xong mà không thấy key thì sao?", a: "Hãy thử làm lại từ đầu và không thoát giữa chừng. Nếu vẫn lỗi, nhắn trên Discord của LPT Hub để được hỗ trợ." }
];

const PAGES = [
  { path: "/", title: "Trang chủ" },
  { path: "/get-key", title: "Lấy key" },
  { path: "/games", title: "Game hỗ trợ" },
  { path: "/docs", title: "Tài liệu API và MCP" },
  { path: "/about", title: "Giới thiệu" },
  { path: "/contact", title: "Liên hệ" },
  { path: "/privacy", title: "Quyền riêng tư" }
];

module.exports = { SITE_URL, DISCORD, LOGO, TITLE, LEAD, STEPS, ABOUT, FAQ, PAGES };
