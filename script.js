const startButton = document.getElementById("startButton");
const choicePanel = document.getElementById("choicePanel");

startButton.addEventListener("click", () => {
  choicePanel.classList.add("visible");

  choicePanel.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
});