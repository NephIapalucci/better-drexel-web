// @ts-ignore
import stylesheet from "./drexelone-styles.css?raw";

console.log("Better Drexel Web extension loaded. Drexel one page detected. Redesigning...");

let body = document.createElement("div");
body.id = "body";
let html = document.getElementsByTagName("html")[0];
let head = document.head;
if (!head) {
    head = document.createElement("head");
    html.appendChild(head);
}

let style = document.createElement("style");
style.innerHTML = stylesheet;
head.appendChild(style);
html.appendChild(body);

let navbar = document.createElement("nav");
let buttons = {
    home: "home",
    academics: "academics",
    billing: "billing",
    coop: "coop"
};

Object.keys(buttons).forEach(_key => {
    let button = document.createElement("img");
    button.src = "https://flaticons.net/icon.php?slug_category=education&slug_icon=graduate-hat";
    navbar.appendChild(button);
});

body.appendChild(navbar);

let main = document.createElement("main");
main.innerHTML = "Welcome to Drexel One";
body.appendChild(main);

let getStarted = document.createElement("button");
getStarted.id = "get-started";
getStarted.innerHTML = "Get Started";
main.appendChild(getStarted);

(async function main() {
    await refresh();
})();

async function refresh(): Promise<void> {

    let heads = Array.from(document.querySelectorAll("head"));
    if (heads.some(otherHead => otherHead !== head)) {
        heads.forEach(otherHead => {
            if (head !== otherHead) {
                otherHead.remove();
            }
        });
    }

    if (document.body) {
        document.body.remove();
    }

    return new Promise(resolve => {
        setTimeout(async () => {
            await refresh();
            resolve();
        }, 100);
    });
}