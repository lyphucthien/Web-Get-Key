// English <-> Vietnamese switcher. English is the page source; Vietnamese is applied in the browser.
// The choice is saved in localStorage ("lpt_lang"). Without a saved choice the language follows the visitor's
// country (GET /api/lang): Vietnam gets Vietnamese, every other country English. The web default is Vietnamese.
(function (root) {
  "use strict";

  // English text -> Vietnamese text (whole text nodes and attribute values, whitespace-normalised).
  var DICT = {
 "LPT Hub – Free keys for Minecraft and the LPT Hub script": "LPT Hub – Key miễn phí cho Minecraft và script LPT Hub",
 "Free · No account needed": "Miễn phí · Không cần tài khoản",
 "Free keys for Minecraft and LPT Hub": "Key miễn phí cho Minecraft và LPT Hub",
 "Complete one short link and get your key right away. One key works for both the Minecraft server and the LPT Hub script.": "Hoàn thành một link rút gọn là nhận key dùng ngay. Một key dùng được cho cả server Minecraft và script LPT Hub.",
 "Get your key": "Lấy key ngay",
 "See supported games": "Xem game hỗ trợ",
 "How to get a key": "Cách lấy key",
 "Pick a link": "Chọn một link",
 "Work.ink, Link 4m or Link 4 Sub. Any of them works.": "Work.ink, Link 4m hoặc Link 4 Sub, chọn cái nào cũng được.",
 "Finish the link": "Làm đến hết link",
 "When you finish, you are sent back to the key page automatically.": "Hoàn thành xong sẽ tự quay về trang lấy key.",
 "Copy and use your key": "Copy và dùng key",
 "Paste it into the server or script. Each device gets 1 key every 3 hours.": "Dán vào server hoặc script. Mỗi thiết bị nhận 1 key sau mỗi 3 giờ.",
 "FAQ": "Câu hỏi thường gặp",
 "How long does a key last?": "Key dùng được trong bao lâu?",
 "Each device gets 1 key every 3 hours. For the LPT Hub script, a key is tied to one device and expires 3 hours after its first use.": "Mỗi thiết bị nhận 1 key sau mỗi 3 giờ. Với script LPT Hub, key gắn với một thiết bị và hết hạn sau 3 giờ kể từ lần dùng đầu tiên.",
 "What can one key be used for?": "Một key dùng được cho những gì?",
 "One key works for both the Minecraft server and the LPT Hub script. You do not need a separate key for each.": "Một key dùng được cho cả server Minecraft và script LPT Hub, không cần lấy key riêng cho từng nơi.",
 "Why do I have to complete a short link?": "Vì sao phải làm link rút gọn?",
 "Short links (Work.ink, Link 4m, Link 4 Sub) help keep the project free. You must finish the link to be sent back to the key page.": "Các link rút gọn (Work.ink, Link 4m, Link 4 Sub) giúp dự án duy trì miễn phí. Bạn cần làm đến hết link để được đưa về trang lấy key.",
 "I finished but I don't see a key. What now?": "Làm xong mà không thấy key thì sao?",
 "Try again from the start and don't leave halfway. If it still fails, message us on the LPT Hub Discord for help.": "Hãy thử làm lại từ đầu và không thoát giữa chừng. Nếu vẫn lỗi, nhắn trên Discord của LPT Hub để được hỗ trợ.",
 "About": "Giới thiệu",
 "Contact": "Liên hệ",
 "Privacy": "Quyền riêng tư",
 "Docs": "Tài liệu",
 "Complete one short link and get your key right away. One key works for both the Minecraft server and the LPT Hub script. Free, no account needed.": "Hoàn thành một link rút gọn là nhận key dùng ngay. Một key dùng được cho cả server Minecraft và script LPT Hub. Miễn phí, không cần tài khoản.",
 "Footer links": "Liên kết cuối trang",
 "Get a free key – LPT Hub": "Lấy key miễn phí – LPT Hub",
 "Get key": "Lấy key",
 "Verifying...": "Đang xác minh...",
 "YOUR KEY": "KEY CỦA BẠN",
 "Next key available in": "Lấy key mới sau",
 "Guide & notes": "Hướng dẫn & lưu ý",
 "Click Work.ink, Link 4m or Link 4 Sub, then complete the steps on that page.": "Bấm Work.ink, Link 4m hoặc Link 4 Sub rồi hoàn thành các bước trên trang đó.",
 "Copy and use the key": "Copy key và dùng",
 "When you finish, you come back to this page and the key appears. Click the copy icon, then paste it into the Minecraft server or the LPT Hub script.": "Xong sẽ tự quay lại trang này và hiện key. Bấm biểu tượng sao chép rồi dán vào server Minecraft hoặc script LPT Hub.",
 "Finish the link to be sent back to this page. If you leave halfway, you have to start over.": "Làm đến hết link để được đưa về trang này. Thoát giữa chừng thì phải làm lại.",
 "Each device gets 1 key every 3 hours.": "Mỗi thiết bị nhận 1 key sau mỗi 3 giờ.",
 "One key works for both Minecraft and LPT Hub. On the script, a key is tied to one device and expires 3 hours after its first use.": "Một key dùng cho cả Minecraft và LPT Hub. Trên script, key gắn với một thiết bị và hết hạn sau 3 giờ kể từ lần dùng đầu.",
 "Get a free key for Minecraft and LPT Hub: pick a short link, finish it, and get your key right on the page.": "Lấy key miễn phí cho Minecraft và LPT Hub: chọn một link rút gọn, hoàn thành rồi nhận key ngay trên trang.",
 "Copy key": "Sao chép key",
 "Supported games – LPT Hub": "Game hỗ trợ – LPT Hub",
 "Supported games": "Game hỗ trợ",
 "Click a game to see its features in detail.": "Bấm vào một game để xem chi tiết chức năng.",
 "supported": "đang hỗ trợ",
 "Loading games...": "Đang tải danh sách game...",
 "Get a key for this game": "Lấy key cho game này",
 "The games LPT Hub supports and the features of each. Search and view details for every game.": "Danh sách game LPT Hub đang hỗ trợ cùng chức năng của từng game. Tìm kiếm và xem chi tiết từng game.",
 "Search games": "Tìm game",
 "Search games...": "Tìm game...",
 "Close": "Đóng",
 "About – LPT Hub": "Giới thiệu – LPT Hub",
 "About LPT Hub": "Giới thiệu LPT Hub",
 "LPT Hub is a free key system for a Minecraft server and the LPT Hub script. The goal of the project is to let everyone try and use these tools without paying or creating an account. You just open the key page, pick a short link, complete it, and get your key right on the page.": "LPT Hub là một hệ thống key miễn phí dành cho server Minecraft và script LPT Hub. Mục tiêu của dự án là để mọi người có thể dùng thử và sử dụng các công cụ này mà không phải trả phí hay tạo tài khoản. Bạn chỉ cần vào trang lấy key, chọn một link rút gọn, hoàn thành link đó và nhận key ngay trên trang.",
 "How the project works": "Dự án hoạt động như thế nào",
 "Each time you complete a short link (Work.ink, Link 4m or Link 4 Sub), the server checks that you followed the proper flow and then issues a key. Each device gets 1 key every 3 hours. One key works for both the Minecraft server and the LPT Hub script, and for the script the key is tied to one device and expires 3 hours after its first use.": "Mỗi lần bạn hoàn thành một link rút gọn (Work.ink, Link 4m hoặc Link 4 Sub), máy chủ sẽ kiểm tra bạn đã đi đúng quy trình rồi cấp một key. Mỗi thiết bị nhận 1 key sau mỗi 3 giờ. Một key dùng được cho cả server Minecraft và script LPT Hub, và với script thì key gắn với một thiết bị và hết hạn sau 3 giờ kể từ lần dùng đầu tiên.",
 "Why there are short links": "Vì sao có link rút gọn",
 "Short links help cover the cost of running the project, which keeps keys free for users. These sites are run by third parties and have their own policies, so be careful with the ads shown on them.": "Các link rút gọn là nguồn hỗ trợ chi phí duy trì dự án, nhờ đó key luôn miễn phí cho người dùng. Những trang này do bên thứ ba vận hành và có chính sách riêng, vì vậy hãy cẩn thận với quảng cáo hiển thị trên đó.",
 "Notes": "Lưu ý",
 "Minecraft is a trademark of Mojang and Microsoft. LPT Hub is an independent project and is not affiliated with or sponsored by them. If you need help or want to give feedback, see the": "Minecraft là thương hiệu của Mojang và Microsoft. LPT Hub là dự án độc lập, không liên kết với và không được bảo trợ bởi họ. Nếu cần hỗ trợ hoặc muốn góp ý, xem trang",
 "page.": ".",
 "LPT Hub is a free key system for a Minecraft server and the LPT Hub script. Learn how the project works and why short links are needed.": "LPT Hub là hệ thống key miễn phí cho server Minecraft và script LPT Hub. Tìm hiểu dự án hoạt động thế nào và vì sao cần link rút gọn.",
 "Contact – LPT Hub": "Liên hệ – LPT Hub",
 "Contact LPT Hub": "Liên hệ LPT Hub",
 "LPT Hub's official support channel is its Discord server. You can ask how things work, report key problems, suggest new games, or request deletion of your data there:": "Kênh hỗ trợ chính thức của LPT Hub là máy chủ Discord. Bạn có thể hỏi cách dùng, báo lỗi lấy key, góp ý game mới hoặc yêu cầu xóa dữ liệu của mình tại đó:",
 ". LPT Hub does not currently offer email or phone support.": ". Hiện LPT Hub chưa dùng email hay số điện thoại hỗ trợ.",
 "When reporting a key problem": "Khi báo lỗi lấy key",
 "For faster help, tell us which link you chose (Work.ink, Link 4m or Link 4 Sub), when you did the link, and the message shown on the key page. A screenshot is usually enough. Do not share a key you are using with strangers.": "Để được hỗ trợ nhanh hơn, hãy cho biết bạn đã chọn link nào (Work.ink, Link 4m hay Link 4 Sub), thời điểm bạn làm link, và dòng thông báo hiện ra trên trang lấy key. Một ảnh chụp màn hình thường là đủ. Đừng gửi key đang dùng cho người lạ.",
 "Response time": "Thời gian phản hồi",
 "LPT Hub is a personal project, so response times can vary. Before messaging, try again from the start and do not leave the short link halfway, because most problems come from leaving the link too early or going too fast.": "LPT Hub là dự án cá nhân nên thời gian phản hồi có thể khác nhau tùy lúc. Trước khi nhắn, bạn nên thử làm lại từ đầu và không thoát giữa chừng khi làm link rút gọn, vì phần lớn lỗi đến từ việc thoát link quá sớm hoặc làm quá nhanh.",
 "See also": "Xem thêm",
 "and": "và",
 "How to contact LPT Hub and get support: message us on Discord, and what to include when reporting a key problem.": "Cách liên hệ và nhận hỗ trợ từ LPT Hub: nhắn trên Discord, thông tin cần cung cấp khi báo lỗi lấy key.",
 "Privacy – LPT Hub": "Quyền riêng tư – LPT Hub",
 "This page explains what data LPT Hub handles when you get and use a key. LPT Hub does not sell data and does not use its own analytics or advertising tools.": "Trang này giải thích LPT Hub xử lý dữ liệu gì khi bạn lấy và dùng key. LPT Hub không bán dữ liệu và không dùng công cụ phân tích hay quảng cáo riêng.",
 "Data we store": "Dữ liệu chúng tôi lưu",
 "IP address:": "Địa chỉ IP:",
 "stored for up to 3 hours to limit each device to one key every 3 hours.": "lưu tối đa 3 giờ để giới hạn mỗi thiết bị một key mỗi 3 giờ.",
 "Issued keys:": "Key đã cấp:",
 "stored so we can check whether a key is valid.": "lưu để kiểm tra key có hợp lệ hay không.",
 "Device ID (HWID) and first-use time:": "Mã thiết bị (HWID) và thời điểm dùng đầu tiên:",
 "sent by the LPT Hub script to tie a key to one device and calculate the 3-hour expiry.": "script LPT Hub gửi lên để gắn key với một thiết bị và tính hạn 3 giờ.",
 "Minecraft username and Discord ID:": "Tên Minecraft và Discord ID:",
 "only when you activate a key for the Minecraft server, used to confirm the account has been activated.": "chỉ khi bạn kích hoạt key cho server Minecraft, dùng để xác nhận tài khoản đã được kích hoạt.",
 "Cookies and browser storage": "Cookie và bộ nhớ trình duyệt",
 "Language:": "Ngôn ngữ:",
 "detected once from your IP address by Vercel to choose English or Vietnamese (only Vietnam gets Vietnamese). The IP address is not stored, and your choice is kept in your browser.": "Vercel xác định quốc gia từ địa chỉ IP của bạn một lần để chọn tiếng Anh hoặc tiếng Việt (chỉ Việt Nam được tiếng Việt). Địa chỉ IP không được lưu, và lựa chọn của bạn được giữ trong trình duyệt.",
 "When you click a short link, the site sets a": "Khi bạn bấm một link rút gọn, trang đặt cookie",
 "cookie (up to 30 minutes) to check that you followed the proper flow, and a": "(tối đa 30 phút) để kiểm tra bạn đã đi đúng quy trình, và cookie",
 "cookie (up to 15 minutes) to issue the key. The key you receive and the time you received it are saved in your browser (localStorage) so it can be shown again and the wait time can be counted down.": "(tối đa 15 phút) để cấp key. Key vừa nhận và thời điểm nhận được lưu trong bộ nhớ trình duyệt (localStorage) để hiển thị lại và đếm thời gian chờ.",
 "Third parties": "Bên thứ ba",
 "The site is hosted on Vercel and key data is stored with Vercel KV. The short links (Work.ink, Link 4m, Link 4 Sub) are run by third parties with their own privacy and advertising policies that LPT Hub does not control.": "Trang web được lưu trữ trên Vercel, dữ liệu key lưu bằng Vercel KV. Các link rút gọn (Work.ink, Link 4m, Link 4 Sub) do bên thứ ba vận hành, có chính sách quyền riêng tư và quảng cáo riêng mà LPT Hub không kiểm soát.",
 "Data deletion requests": "Yêu cầu xóa dữ liệu",
 "If you want your Minecraft username, Discord ID or key removed from the system, message us on Discord as described on the": "Nếu muốn xóa tên Minecraft, Discord ID hoặc key của bạn khỏi hệ thống, hãy nhắn trên Discord theo hướng dẫn ở trang",
 "What data LPT Hub stores, what it is used for, how long it is kept, and how to request deletion.": "LPT Hub lưu những dữ liệu nào, dùng để làm gì, lưu bao lâu và cách yêu cầu xóa dữ liệu.",
 "max distance to draw a link": "khoảng cách tối đa để nối",
 "mouse influence radius": "bán kính ảnh hưởng của chuột",
 "min / max speed": "tốc độ nhỏ nhất / lớn nhất",
 "movement jitter": "độ lộn xộn khi di chuyển",
 "fade-out speed when the mouse is near": "tốc độ mờ khi chuột ở gần",
 "fade-in speed once the mouse moves away": "tốc độ hiện lại khi chuột đã đi xa",
 "You already got a key. You can get a new one when the wait time ends.": "Bạn đã nhận key. Có thể lấy key mới khi hết thời gian chờ.",
 "Pick a link, finish it, and get your key.": "Chọn một link, hoàn thành rồi nhận key.",
 "Getting your KEY...": "Đang lấy KEY...",
 "Could not get your KEY. Please redo the link.": "Không lấy được KEY. Vui lòng làm lại link.",
 "Server connection error, please try again.": "Lỗi kết nối server, vui lòng thử lại.",
 "You haven't completed a link. Click one of the links below and finish it.": "Bạn chưa hoàn thành link. Hãy bấm một link bên dưới và làm đến hết.",
 "You finished the link too quickly. Click the link again and complete every step.": "Bạn hoàn thành link quá nhanh. Hãy bấm lại link và làm đủ các bước.",
 "The link session has expired. Click the link again.": "Phiên làm link đã hết hạn. Hãy bấm lại link.",
 "Verification failed. Please redo the link.": "Không xác minh được. Vui lòng làm lại link.",
 "No description yet.": "Chưa có mô tả.",
 "Features": "Chức năng",
 "No feature list yet.": "Chưa có danh sách chức năng.",
 "No games found.": "Không tìm thấy game nào.",
 "No games yet.": "Chưa có game nào.",
 "Could not load the games list. Please try again later.": "Không tải được danh sách game. Vui lòng thử lại sau.",
 "Home": "Trang chủ",
 "Navigation": "Điều hướng",
 "Games": "Game",
 "Supported": "Đang hỗ trợ",
 "Coming soon": "Sắp có",
 "Get Key": "Lấy key",
 "Language": "Ngôn ngữ"
};

  var STORE = "lpt_lang";
  var GEO = "lpt_lang_geo";
  var DEFAULT_LANG = "vi";
  var norm = function (s) { return s.replace(/\s+/g, " ").trim(); };

  function translate(text, lang) {
    if (lang !== "vi") return text;
    var tr = DICT[norm(text)];
    if (!tr) return text;
    return text.match(/^\s*/)[0] + tr + text.match(/\s*$/)[0];
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { DICT: DICT, translate: translate, norm: norm, DEFAULT_LANG: DEFAULT_LANG };
  if (typeof document === "undefined") return;

  var ATTRS = ["placeholder", "aria-label", "title", "alt", "content"];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };
  var lang = detect();
  var textState = new WeakMap(); // text node -> { en, vi }
  var attrState = new WeakMap(); // element -> { attr: { en, vi } }

  function stored() {
    try { var v = localStorage.getItem(STORE); if (v === "en" || v === "vi") return v; } catch (e) {}
    return null;
  }
  function cachedGeo() {
    try { var v = sessionStorage.getItem(GEO); if (v === "en" || v === "vi") return v; } catch (e) {}
    return null;
  }
  // Saved choice > country detected earlier this session > web default (Vietnamese).
  function detect() { return stored() || cachedGeo() || DEFAULT_LANG; }

  function applyText(node) {
    var st = textState.get(node);
    var cur = node.nodeValue;
    if (st && cur === st.vi) {
      if (lang === "vi") return;
      node.nodeValue = st.en; textState.delete(node); return;
    }
    textState.delete(node);
    if (lang !== "vi") return;
    var vi = translate(cur, "vi");
    if (vi !== cur) { textState.set(node, { en: cur, vi: vi }); node.nodeValue = vi; }
  }

  function applyAttr(el, name) {
    if (el.tagName === "META" && !/^(description|og:title|og:description|twitter:title|twitter:description)$/.test(el.getAttribute("name") || el.getAttribute("property") || "")) return;
    var cur = el.getAttribute(name);
    if (cur == null) return;
    var all = attrState.get(el) || {};
    var st = all[name];
    if (st && cur === st.vi) {
      if (lang === "vi") return;
      el.setAttribute(name, st.en); delete all[name]; return;
    }
    delete all[name];
    if (lang === "vi") {
      var vi = translate(cur, "vi");
      if (vi !== cur) { all[name] = { en: cur, vi: vi }; el.setAttribute(name, vi); }
    }
    attrState.set(el, all);
  }

  function walk(rootNode) {
    if (rootNode.nodeType === 3) { if (!SKIP[rootNode.parentNode && rootNode.parentNode.tagName]) applyText(rootNode); return; }
    if (rootNode.nodeType !== 1 || SKIP[rootNode.tagName]) return;
    var els = [rootNode].concat([].slice.call(rootNode.querySelectorAll("*")));
    els.forEach(function (el) {
      if (SKIP[el.tagName]) return;
      ATTRS.forEach(function (a) { if (el.hasAttribute(a)) applyAttr(el, a); });
    });
    var tw = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        for (var p = n.parentNode; p && p !== rootNode.parentNode; p = p.parentNode) if (SKIP[p.tagName]) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n; while ((n = tw.nextNode())) applyText(n);
  }

  function syncButtons() {
    document.documentElement.setAttribute("lang", lang);
    [].forEach.call(document.querySelectorAll("[data-lang]"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang ? "true" : "false");
    });
  }

  function applyLang(next) {
    lang = next;
    walk(document.documentElement);
    syncButtons();
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: next } }));
  }

  // Explicit choice from the switch: remembered across visits.
  function setLang(next) {
    if (next !== "en" && next !== "vi") return;
    try { localStorage.setItem(STORE, next); } catch (e) {}
    applyLang(next);
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-lang]");
    if (b) setLang(b.getAttribute("data-lang"));
  });

  // Text the page writes later (key messages, game cards) is translated as it appears.
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      if (m.type === "characterData") { if (!SKIP[m.target.parentNode && m.target.parentNode.tagName]) applyText(m.target); }
      else if (m.type === "attributes") applyAttr(m.target, m.attributeName);
      else [].forEach.call(m.addedNodes, walk);
    });
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  function init() { walk(document.documentElement); syncButtons(); }
  init();
  document.addEventListener("DOMContentLoaded", init);

  // The page head hides the body ("lang-pending") on a first visit until the language is known.
  function reveal() { document.documentElement.classList.remove("lang-pending"); }

  // First visit this session with no saved choice: ask the server which country the visitor is in.
  // The answer is kept for the session only and never overrides a choice made with the switch.
  function geoLookup() {
    if (stored() || cachedGeo() || typeof fetch !== "function") return reveal();
    var timer = setTimeout(reveal, 1500);
    fetch("/api/lang", { cache: "no-store", credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (b) {
        var next = b && (b.lang === "vi" || b.lang === "en") ? b.lang : null;
        if (next && !stored()) {
          try { sessionStorage.setItem(GEO, next); } catch (e) {}
          if (next !== lang) applyLang(next);
        }
      })
      .catch(function () {})
      .then(function () { clearTimeout(timer); reveal(); });
  }
  geoLookup();

  root.LPT_I18N = { setLang: setLang, getLang: function () { return lang; }, translate: translate };
})(typeof window !== "undefined" ? window : this);
