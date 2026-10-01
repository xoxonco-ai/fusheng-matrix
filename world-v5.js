const worlds = {
  script: {
    number: "01",
    kicker: "先看見，才有選擇",
    title: "看見劇本",
    description: "那些反覆出現的關係、反應與困住妳的熟悉位置，都有它形成的理由。",
    href: "#four-languages"
  },
  shift: {
    number: "02",
    kicker: "不是改掉自己，是鬆開慣性",
    title: "解開卡點",
    description: "當妳看懂那個自動發生的迴圈，下一次便多了一個可以不同的入口。",
    href: "reading-roles.html"
  },
  home: {
    number: "03",
    kicker: "答案最後要回到生活",
    title: "回到自己",
    description: "不再急著成為更好的人。先把感受、界線與真正想要的生活，一點點帶回來。",
    href: "reading-home.html"
  }
};

const buttons = [...document.querySelectorAll("[data-world]")];
const number = document.querySelector("#choice-number");
const kicker = document.querySelector("#choice-kicker");
const title = document.querySelector("#choice-title");
const description = document.querySelector("#choice-description");
const link = document.querySelector("#choice-link");
const motionToggle = document.querySelector("#motion-toggle");

function selectWorld(name) {
  const next = worlds[name];
  if (!next) return;

  buttons.forEach((button) => {
    const selected = button.dataset.world === name;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  number.textContent = next.number;
  kicker.textContent = next.kicker;
  title.textContent = next.title;
  description.textContent = next.description;
  link.href = next.href;
}

buttons.forEach((button) => {
  button.addEventListener("click", () => selectWorld(button.dataset.world));
});

motionToggle.addEventListener("click", () => {
  const paused = document.body.classList.toggle("motion-paused");
  motionToggle.setAttribute("aria-pressed", String(paused));
  motionToggle.textContent = paused ? "恢復漂浮" : "暫停漂浮";
});
