import * as drexel from "drexel"; // @ts-ignore
import stylesheet from "./degreeworks-styles.css?raw";

console.log("Better Drexel Web extension loaded. DegreeWorks page detected. Attempting to restyle...");
console.log("Running in developer mode. Clearing local storage.");
localStorage.clear();

type Mutable<T> = {
    -readonly [K in keyof T]: T[K];
}

/**
 * Returns the given value as a mutable version of itself. This is purely a type-checking operation and does not
 * affect runtime values. 
 * 
 * **Parmeters**
 * ```ts
 * let value: T
 * ```
 * - The value to return as mutable
 * 
 * **Returns**
 * 
 * `T`: The mutable value
 */
function mutable<T>(t: T): Mutable<T> {
    return t as Mutable<T>
}

declare global {
    interface ObjectConstructor {
        keys<T extends { [key: string]: unknown }>(value: T): (keyof T)[]; 
    }
}

type CompletionState = "Complete" | "Incomplete (Ready to take)" | "In Progress" | "Incomplete (missing prerequisites)";
type DegreeCourse = {
    course: drexel.Course;
    completion: CompletionState,
    hash: number,
    isHidden?: boolean,
    overriddenName?: string,
    isAddedCourse?: boolean,
    overriddenCode?: string
    isHeader?: boolean;
    options?: string[];
};

function hash(text: string) {
    let hash = 0, i, chr;
    if (text.length === 0) return hash;
    for (i = 0; i < text.length; i++) {
        chr = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return hash;
}

class Account {

    private readonly name: string;
    private readonly courses: DegreeCourse[];
    public readonly gpa: string;
    public readonly concentrations: string[];

    /**
     * Creates a new `Account`.
     * 
     * **Parameters**
     * ```ts
     * let name: string
     * ```
     * - The name of the account
     * ```ts
     * let courses: DegreeCourse[]
     * ```
     * - The courses on this account.
     */
    public constructor(properties: {
        name: string,
        courses: DegreeCourse[],
        gpa: string,
        concentrations: string[];
    }) {
        this.name = properties.name;
        this.courses = properties.courses ?? [];
        this.gpa = properties.gpa;
        this.concentrations = properties.concentrations;
    }

    /** The courses tied to this account that have been hidden. */
    public get hiddenCourses(): DegreeCourse[] {
        return this.courses.filter(course => course.isHidden);
    }

    /** The custom courses tied to this account that have been added. */
    public get addedCourses(): DegreeCourse[] {
        return this.courses.filter(course => course.isAddedCourse);
    }

    /** The courses tied to this account that have been renamed. */
    public get renamedCourses(): DegreeCourse[] {
        return this.courses.filter(course => course.overriddenName);
    }

    /** The courses tied to this account that have been completed. */
    public get completedCourses(): DegreeCourse[] {
        return this.courses.filter(course => course.completion === "In Progress" || course.completion === "Complete");
    }

    public forEachCourse(func: (course: DegreeCourse) => any) {
        this.courses.forEach(func);
        this.save();
    }

    /** Renames a course in this account and saves this account to `localStorage`. */
    public renameCourse(course: DegreeCourse, newName: string): void {
        console.log(`Renaming "${course.course.properName}" to "${newName}"`);
        this.courseFrom(course).overriddenName = newName;
        this.save();
    }

    public renameCourseCode(course: DegreeCourse, newCode: string): void {
        console.log(`Renaming course code for ${course.course.properName} to ${newCode}`);
        course = this.courseFrom(course);
        course.overriddenCode = newCode;
        this.save();
    }

    public hideCourse(course: DegreeCourse): void {
        course = this.courseFrom(course);
        course.isHidden = true;
        this.save();
    }

    public addCourse(course: DegreeCourse) {
        this.courses.push(course);
        this.save();
    }

    public addCourseBefore(course: DegreeCourse, afterCourse: DegreeCourse) {
        course = this.courseFrom(course);
        this.courses.splice(this.courses.indexOf(this.courseFrom(afterCourse)), 0, course)
        this.save();
    }

    private courseFrom(course: DegreeCourse) {
        return this.courses.find(thisCourse => thisCourse.course.codeName === course.course.codeName)!;
    }

    /**
     * Refreshes the completion status on the given course based on
     * prerequisites.
     * 
     * **Parameters**
     * ```ts
     * let course: DegreeCourse
     * ```
     * - The course to refresh
     */
    public refreshCompletion(course: DegreeCourse): void {
        course = this.courseFrom(course);
        let drexelCourse = drexel.courseWith({ codeName: course.overriddenCode ?? course.course.codeName });
        if (course.completion === "Incomplete (missing prerequisites)" && drexelCourse) {
            course.completion = drexel.canTake(drexelCourse, this.completedCourses.map(completedCourse => drexel.courseWith({ codeName: completedCourse.overriddenCode ?? completedCourse.course.codeName })!).filter(exists => exists)) ? "Incomplete (Ready to take)" : "Incomplete (missing prerequisites)";
        }
        let completion = completionStyleFor(course.completion);

        let topBar = document.querySelector<HTMLElement>(`#course-${course.hash}-topbar`);
        let bubble = document.querySelector<HTMLElement>(`#course-${course.hash}-bubble`);
        let status = document.querySelector<HTMLElement>(`#course-${course.hash}-completion-status`);

        if (topBar) topBar.style.backgroundColor = completion.brightColor;
        if (status) {
            status.innerHTML = course.completion;
            status.style.color = completion.brightColor;
        }
        if (bubble) {
            bubble.style.color = completion.darkColor;
            bubble.innerHTML = completion.text;
        }

    }

    /**
     * Calls {@link refreshCompletion} for all courses tied to this account.
     */
    public refreshCompletions() {
        this.forEachCourse(course => this.refreshCompletion(course));
    }

    /**
     * Returns the prerequisites that are missing to take the given course.
     * 
     * **Parameters**
     * ```ts
     * let course: DegreeCourse
     * ```
     * - The course to get the prerequisites of
     * 
     * **Returns**
     * 
     * An array of the missing prerequisites
     */
    public missingPrerequisitesFor(course: DegreeCourse): any[] {
        let drexelCourse = drexel.courseWith({ codeName: course.course.codeName })!;
        let completedCourses = this.completedCourses.map(completed => drexel.courseWith({ codeName: completed.overriddenCode ?? completed.course.codeName })!).filter(c => c);
        let missingReqs = drexel.missingPrerequisites(drexelCourse, completedCourses);
        return missingReqs;
    }

    public setCourseState(course: DegreeCourse, state: CompletionState) {
        course = this.courseFrom(course);
        course.completion = state;
        this.save();
    }

    /** Saves this account data to `localStorage`. This should be called whenever data tied to this account is updated. */
    public save(): void {
        let accounts = JSON.parse(localStorage.getItem("accounts")!);
        accounts[this.name] = this.toJSON();
        localStorage.setItem("accounts", JSON.stringify(accounts));
    }

    /**
     * Converts this `Account` object to a `JSON` object. 
     */
    private toJSON() {
        return {
            name: this.name,
            courses: this.courses,
            gpa: this.gpa,
            concentrations: this.concentrations
        };
    }
}

// Define globals
let currentAccount: Account;
let refreshed = false;
let loading: HTMLElement;

if (!localStorage.getItem("accounts")) localStorage.setItem("accounts", JSON.stringify({}));
document.querySelector<HTMLElement>(":root")!.style.fontSize = "12px";

// Add clickoutside event listener
let originalEventListener = HTMLElement.prototype.addEventListener;
HTMLElement.prototype.addEventListener = function (type: "clickoutside" | keyof HTMLElementEventMap, listener: (event?: any) => void) {
    if (type === "clickoutside") {
        document.addEventListener("click", event => {
            if (!event.composedPath().includes(this)) {
                listener(event);
            }
        });
    } else {
        originalEventListener.call(this, type, listener);
    }
};

// Main Script
(async function main() {

    document.querySelector("frame[name='frFooter']")?.remove();
    console.log("Data received. Redesigning...")
    console.log("%cThere will be several errors below this line. These are from the regular DegreeWorks page, not better-drexel-web, and are unavoidable (and normal). Ignore them.", "color: cyan; font-weight: bold;");

    // Create elements
    let main = createMainDiv();
    let nav = createNavbar();

    // Style document
    {
        let html = document.querySelector<HTMLHtmlElement>("html")!;
        let body = document.createElement("div");
        body.appendChild(nav);
        body.appendChild(main);
        body.id = "body";
        html.appendChild(body);
        let head = document.head;
        if (!head) {
            head = document.createElement("head");
            html.appendChild(head);
            mutable(document).head = head;
        }

        // Create title
        let title = document.createElement("title");
        title.innerHTML = "Drexel DegreeWorks";
        head.appendChild(title);

        // Style
        let styleElement = document.createElement("style");
        styleElement.innerHTML = stylesheet;
        head.appendChild(styleElement);

        // Loading Screen
        loading = document.createElement("div");
        loading.innerHTML = "Loading DegreeWorks...";
        loading.id = "loading";
        let loadingSubtitle = document.createElement("p");
        loadingSubtitle.innerHTML = "Subsequent loads will be faster.";
        loading.appendChild(loadingSubtitle);
        body.appendChild(loading);
    }

    // Get current account
    let accountName = localStorage.getItem("current account");
    if (accountName) {
        loading.remove();
        let accountJSON = JSON.parse(localStorage.getItem("accounts")!)[accountName];
        currentAccount = new Account({
            name: accountJSON.name,
            courses: accountJSON.courses,
            gpa: accountJSON.gpa,
            concentrations: accountJSON.concentrations
        });
    } else {
        console.log("Unable to fetch account data from localStorage. Refreshing...");
        await refresh();
    }

    // Create cards 
    currentAccount!.forEachCourse(course => {
        let card = createCourseCard(course);
        if (card) main.append(card);
    });

    if (!refreshed) await refresh();
})();

/**
 * Refreshes the user's data based on the DegreeWorks elements. If the data is not yet loaded into the page, this
 * function will run every second until it is loaded. The promise returned by the function will be resolved when
 * and only when the data is loaded into the page and `localStorage` is refreshed.
 */
async function refresh(): Promise<void> {

    try {
        // Fetch the main document
        refreshed = true;
        let frame = document.querySelector("frameset > frame[name='frBodyContainer']") as HTMLFrameElement;
        let doc = (frame.contentDocument || frame.contentWindow!.document)!;
        let frame2 = doc.querySelector("frameset > frame[name='frBody']") as HTMLFrameElement;
        let mainDocument = frame2.contentDocument || frame2.contentWindow!.document!;

        let lines = Array.from(mainDocument.querySelectorAll(".bgLight0, .bgLight98, .bgLight100, .BlockHeadTitle"));

        // Fetch the current account from the page elements
        currentAccount = (() => {
            let topTable = mainDocument.querySelector<HTMLElement>(".AuditTable .Inner tbody")!;
            let rows = Array.from(topTable.children);
            let data: { [key: string]: string } = {};
            rows.forEach(row => {
                let children = Array.from(row.children);
                for (let i = 0; i < children.length - 1; i += 2) {
                    data[children[i].textContent!.trim()] = children[i + 1].textContent!.trim();
                }
            });
            let name = data.Student;
            let rawContentrationText = data["Concentration(s)"];
            let concentrations = (() => {
                let concentrations: string[] = [];
                let dummyString = "";
                let prevChar: string | null = null;
                for (let i = 0; i < rawContentrationText.length; i++) {
                    let char = rawContentrationText.charAt(i);
                    if ((prevChar &&
                        prevChar.toLowerCase() === prevChar && prevChar.toUpperCase() !== prevChar &&
                        char === char.toUpperCase() && char !== char.toLowerCase())) {
                        concentrations.push(dummyString);
                        dummyString = "";
                    }
                    dummyString += char === "&" ? "and" : char;
                    prevChar = char;
                }
                concentrations.push(dummyString);
                return concentrations;
            })();
            let accounts = JSON.parse(localStorage.getItem("accounts")!);
            if (!accounts[name]) accounts[name] = { ...data, courses: [] };
            localStorage.setItem("accounts", JSON.stringify(accounts));
            localStorage.setItem("current account", name);
            return new Account({
                name: name,
                courses: accounts[data.Student].courses,
                gpa: data["Overall GPA"],
                concentrations: concentrations
            });
        })();

        // Generate courses from the page
        lines.forEach(line => {
            let text: string = line.classList.contains("BlockHeadTitle") ? line.textContent!.trim() : (line.querySelector(".RuleLabelTitleNeeded, .RuleLabelTitleNotNeeded")?.textContent!.trim() ?? "Unknown Course Name");
            let course: DegreeCourse = null!;
            let elem = Array.from(line.querySelectorAll(".RuleAdviceData")).find(e => e.textContent) ?? line.querySelector(".CourseAppliedDataDiscNum");
            if (elem && elem.textContent) {
                let content = elem.textContent.trim().replaceAll(/\s+/g, " ");
                try {
                    let tokens = tokenizeCourseExpression(content);
                    let courses = tokens.filter(token => token.type === "course");
                    if (courses.length === 1) {
                        let drexelCourse = drexel.courseWith({ codeName: courses[0].value })!;
                        let canBeTaken = drexelCourse ? drexel.canTake(drexelCourse, currentAccount.completedCourses.map(course => course.course)) : true;
                        let completion: CompletionState = line.classList.contains("bgLight100") ? "Complete" : line.classList.contains("bgLight98") ? "In Progress" : canBeTaken ? "Incomplete (Ready to take)" : "Incomplete (missing prerequisites)";
                        course = {
                            course: drexelCourse,
                            completion,
                            hash: hash(drexelCourse.properName),
                            isHeader: line.classList.contains("BlockHeadTitle") || undefined
                        }
                    } else if (courses.length > 1) {
                        let choices = tokens.filter(token => token.type === "course").map(token => drexel.courseWith({ codeName: token.value })?.properName ?? token.value);
                        course = {
                            course: {
                                properName: `${tokens.find(token => token.value != "(")!.value} various choices`,
                                codeName: "Multiple course codes",
                                credits: 0,
                                prerequisites: [],
                                majorName: "unknown"
                            },
                            completion: "Incomplete (Ready to take)",
                            hash: hash(text),
                            options: choices,
                            isHeader: line.classList.contains("BlockHeadTitle") || undefined
                        };
                    }
                } catch (error) { }
            }

            if (!course) {
                let lower = text.toLowerCase().trim();
                let isHeader = lower.includes("requirements");
                if (text === "Major Requirements") isHeader = false;
                if (text === text.toUpperCase()) isHeader = true;
                if (line.classList.contains("BlockHeadTitle")) isHeader = !(lower.startsWith("bachelor of") || lower.startsWith("major in"));
                if (isHeader && lower.includes("co-op")) text = "Cooperative Education";

                if (isHeader) {
                    course = {
                        course: {
                            properName: text,
                            codeName: "Header",
                            credits: 0,
                            prerequisites: [],
                            majorName: "Unknown Major"
                        },
                        hash: hash(text),
                        completion: "Incomplete (Ready to take)",
                        isHeader: true
                    };
                }
            }
            
            if (course) {
                let lower = course.course.properName.toLowerCase();
                if (course.isHeader || !(lower.includes("concentration") || lower.includes("sequence") || lower.includes("of the following"))) {
                    currentAccount.addCourse(course);
                }
            }
        });

        document.querySelector("frameset")?.remove();
        Array.from(document.head.children).forEach(child => child.remove());

        let styleElement = document.createElement("style");
        styleElement.innerHTML = stylesheet;
        document.head.appendChild(styleElement);

        let title = document.createElement("title");
        title.innerHTML = "Drexel DegreeWorks";
        document.head.appendChild(title);

        loading.remove();

        currentAccount.refreshCompletions();
        let heads = document.getElementsByTagName("head");
        heads[heads.length - 1].remove();
        console.clear();
        console.log("%cRefresh completed successfully.", "color: lime; font-weight: bold;");
    }

    catch (error) {
        return new Promise(resolve => {
            setTimeout(async () => {
                await refresh();
                resolve();
            }, 1000);
        });
    }
}

function createNavbar(): HTMLElement {
    let nav = document.createElement("div");
    nav.innerHTML = "Drexel DegreeWorks";
    nav.id = "navbar";
    nav.appendChild(createLogoutButton());
    return nav;
}

/**
 * Creates and returns the logout button.
 */
function createLogoutButton(): HTMLElement {
    let logout = document.createElement("div");
    logout.id = "logout";
    logout.innerHTML = "Logout";
    logout.addEventListener("click", _event => {
        window.location.href = "javascript:DoLogout(); void 0";
    });

    return logout;
}

function createMainDiv(): HTMLElement {
    let main = document.createElement("div");
    main.id = "main";
    return main;
}

function createHeader(course: DegreeCourse): HTMLElement {
    let header = document.createElement("div");
    let headerText = document.createElement("p");
    headerText.innerHTML = (course.overriddenName ?? course.course.properName).toLowerCase();
    header.className = "course-header";
    headerText.spellcheck = false;
    headerText.contentEditable = "true";
    headerText.addEventListener("focusout", _event => {
        currentAccount.renameCourse(course, header.innerHTML);
    });
    headerText.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            header.blur();
            currentAccount.renameCourse(course, header.innerHTML);
        }
    });

    function createButton(text: string, onClick?: (event?: MouseEvent) => void): HTMLElement {
        let element = document.createElement("div");
        element.style.height = "fit-content";
        element.style.paddingTop = "0.1rem";
        element.style.paddingBottom = "0.1rem";
        element.innerHTML = text;
        element.style.paddingLeft = "1rem";
        element.style.paddingRight = "1rem";
        element.style.cursor = "pointer";
        element.contentEditable = "false";

        element.addEventListener("mouseover", _event => {
            element.style.backgroundColor = "#555566";
        });
        element.addEventListener("mouseleave", _event => {
            element.style.backgroundColor = "transparent";
        });
        element.addEventListener("click", event => {
            if (onClick) onClick(event);
        });

        return element;
    }

    header.addEventListener("contextmenu", event => {
        event.preventDefault();
        let cm = document.createElement("div");
        cm.addEventListener("clickoutside", _event => {
            cm.remove();
        });
        let rect = header.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;
        cm.contentEditable = "false";
        cm.style.left = `${x}px`;
        cm.style.top = `${y}px`;
        cm.classList.add("context-menu");
        cm.setAttribute("data-context-menu", "true");
        cm.appendChild(createButton("Remove course section", _event => {
            header.remove();
            cm.remove();
        }));
        header.appendChild(cm);
    });

    header.appendChild(headerText);
    return header;
}

function completionStyleFor(completion: CompletionState) {
    switch (completion) {
        case "Incomplete (Ready to take)": return { brightColor: "#888899", darkColor: "#8888CC", text: "–" };
        case "Incomplete (missing prerequisites)": return { brightColor: "#FF8888", darkColor: "#CC8888", text: "✕" };
        case "Complete": return { brightColor: "#88FF88", darkColor: "#88CC88", text: "✓" };
        case "In Progress": return { brightColor: "#FFFF88", darkColor: "#CCCC88", text: "≈" };
    }
}

/**
 * Creates a course card element if the given course is recognized as a proper course.
 * 
 * **Parameters**
 * ```ts 
 * let course: DegreeCourse
 * ```
 * - The course to make a card with
 * 
 * **Returns**
 * 
 * The card element
 */
function createCourseCard(course: DegreeCourse): HTMLElement | null {

    // Check if header and return header element if so
    if (course.isHidden) return null;
    if (course.isHeader) return createHeader(course);

    let completion = completionStyleFor(course.completion);

    // Main course card
    let card = document.createElement("div");
    card.className = "course-card";
    card.addEventListener("mouseover", _event => {
        card.style.scale = "1.05";
        card.style.boxShadow = "0px 0px 15px black";
    });
    card.addEventListener("mouseleave", _event => {
        card.style.scale = "";
        card.style.boxShadow = "";
    });

    // Top completion bar
    let topBar = document.createElement("div");
    topBar.style.backgroundColor = completion.brightColor;
    topBar.id = `course-${course.hash}-topbar`;
    topBar.className = "top-bar";

    // Main area
    let main = document.createElement("div");
    main.className = "main";

    // Course name title
    let title = document.createElement("h1"); {
        title.innerHTML = course.overriddenName ?? course.course.properName;
        title.contentEditable = "true";
        title.className = "title";
        title.id = `course-${hash(course.course.properName)}-title`;
        title.addEventListener("focusout", _event => {
            currentAccount.renameCourse(course, title.textContent!);
        });
        title.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                title.blur();
                currentAccount.renameCourse(course, title.textContent!);
            }
        });
    }

    // Course code
    let code = document.createElement("p"); {
        code.className = "code";
        if (!course.course.codeName || course.course.codeName === "Unknown course code") {
            if (course.course.properName.toLowerCase().includes("elective")) course.course.codeName = "Electives";
            else if (course.course.properName.toLowerCase().includes("gpa")) course.course.codeName = `Current GPA: ${currentAccount.gpa}`;
            else course.course.codeName = "Unknown course code";
        }
        code.innerHTML = course.overriddenCode ?? course.course.codeName;
        code.contentEditable = "true";
        function renameCourseCode(code: string) {
            currentAccount.renameCourseCode(course, code);
            let drexelCourse = drexel.courseWith({ codeName: code });
            if (drexelCourse) {
                title.innerHTML = drexelCourse.properName;
                currentAccount.renameCourse(course, drexelCourse.properName);
                currentAccount.refreshCompletions();
            }
        }
        code.addEventListener("focusout", _event => {
            renameCourseCode(code.innerHTML);
        });
        code.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                code.blur();
                renameCourseCode(code.innerHTML);
            }
        });
    }

    // Completion Status
    let status = document.createElement("p"); {
        status.innerHTML = course.completion;
        status.className = "status";
        status.style.color = completion.brightColor;
        status.id = `course-${course.hash}-completion-status`;
    }

    // Completion bubble
    let bubble = document.createElement("div"); {
        bubble.className = "bubble";
        bubble.innerHTML = completion.text;
        bubble.style.color = completion.darkColor;
        bubble.id = `course-${course.hash}-bubble`

        let completionStates = {
            "Complete": { color: "#88FF88", character: "✓" },
            "Incomplete (missing prerequisites)": { color: "#FF8888", character: "✕" },
            "Incomplete (Ready to take)": { color: "#888899", character: "–" },
            "In Progress": { color: "#FFFF88", character: "≈" }
        } as const;

        bubble.addEventListener("mouseover", _event => {
            bubble.style.scale = "1.2";
            bubble.style.outline = "3px solid royalblue";
        });

        bubble.addEventListener("mouseleave", _event => {
            bubble.style.scale = "";
            bubble.style.outline = "";
        });

        bubble.addEventListener("click", _event => {
            let keys = Object.keys(completionStates);
            course.completion = keys[(keys.indexOf(course.completion) + 1) % keys.length];
            let state = completionStates[course.completion as keyof typeof completionStates];
            currentAccount.setCourseState(course, course.completion);
            bubble.style.color = state.color;
            topBar.style.backgroundColor = state.color;
            status.innerHTML = course.completion;
            status.style.color = state.color;
            bubble.innerHTML = state.character;
        });
    }

    // Context menu on right click
    card.addEventListener("contextmenu", event => {
        event.preventDefault();
        Array.from(document.querySelectorAll("*[data-context-menu='true']")).forEach(contextMenu => contextMenu.remove());
        let cm = document.createElement("div");
        let rect = card.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;
        cm.style.left = `${x}px`;
        cm.style.top = `${y}px`;
        cm.classList.add("context-menu");
        cm.setAttribute("data-context-menu", "true");

        function createButton(text: string, onClick?: (event?: MouseEvent) => void): HTMLElement {
            let element = document.createElement("div");
            element.style.height = "fit-content";
            element.style.paddingTop = "0.1rem";
            element.style.paddingBottom = "0.1rem";
            element.innerHTML = text;
            element.style.paddingLeft = "1rem";
            element.style.paddingRight = "1rem";
            element.style.cursor = "pointer";

            element.addEventListener("mouseover", _event => {
                element.style.backgroundColor = "#555566";
            });
            element.addEventListener("mouseleave", _event => {
                element.style.backgroundColor = "transparent";
            });
            element.addEventListener("click", event => {
                if (onClick) onClick(event);
            });

            return element;
        }

        cm.appendChild(createButton("Hide this course", _event => {
            currentAccount.hideCourse(course);
            card.remove();
            cm.remove();
        }));
        cm.appendChild(createButton("Rename this course", _event => {
            title.focus();
            cm.remove();
        }));
        cm.appendChild(createButton("Edit completion status"));
        cm.appendChild(createButton("Edit course code"));

        // Add course before
        cm.appendChild(createButton("Add course before this", _event => {
            let newCourse: DegreeCourse = {
                course: {
                    properName: "Unnamed Course",
                    codeName: "Undefined Course Code",
                    credits: 0,
                    prerequisites: [],
                    majorName: "Unknown Major"
                },
                hash: 0,
                completion: "Incomplete (Ready to take)"
            };
            let newCard = createCourseCard(newCourse);
            if (newCard) card.parentElement!.insertBefore(newCard, card);
            currentAccount.addCourseBefore(newCourse, course);
            cm.remove();
        }));

        cm.appendChild(createButton("Add course after this"));

        // Add header before
        cm.appendChild(createButton("Add header before this", _event => {
            let newHeader: DegreeCourse = {
                course: {
                    properName: "Untitled Header",
                    codeName: "Undefined Course Code",
                    credits: 0,
                    prerequisites: [],
                    majorName: "Unknown Major"
                },
                completion: "Incomplete (Ready to take)",
                hash: 0,
                isHeader: true
            };
            let newCard = createHeader(newHeader);
            if (newCard) card.parentElement!.insertBefore(newCard, card);
            currentAccount.addCourseBefore(newHeader, course);
            cm.remove();
        }));

        cm.appendChild(createButton("Add header after this"));
        cm.addEventListener("clickoutside", _event => {
            cm.remove();
        });
        cm.appendChild(createButton("Show missing prerequisites", _event => {
            console.log(currentAccount.missingPrerequisitesFor(course));
        }));
        cm.appendChild(createButton("Show options", _event => {
            console.log(course.options);
        }));
        main.appendChild(cm);
    });

    topBar.appendChild(bubble);
    card.appendChild(topBar);
    main.appendChild(title);
    main.appendChild(code);
    main.appendChild(status);
    card.appendChild(main);

    return card;
}

type AllCoursesOf = {
    allOf: CourseRequirement[];
}

type OneCourseOf = {
    oneOf: CourseRequirement[];
}

type CourseRequirement = OneCourseOf | AllCoursesOf | DegreeCourse;

function tokenizeCourseExpression(expression: string): { type: string, value: string }[] {
    expression = expression.replaceAll("*", "");
    let original = expression;
    let tokens: { type: string, value: string }[] = [];
    let tokenTypes = {
        or: /^\s*or\s*/,
        and: /^\s*and\s*/,
        classesIn: /^\s*\d+\s+Class(es)?\s+in\s+/,
        creditsIn: /^\s*\d+(\.\d+)?\s*Credits?\s+in\s+/,
        course: /^\s*([A-Z@]*)\s*([TI]?\d{3,4}(?:\:\d+)?)\s*/,
        withAttribute: /^\s*with\s*Attribute\s*[A-Z]+\s*(or\s*[A-Z]+\s*)*/,
        parentheses: /^\s*[\(\)]\s*/,
        whitespace: /^[\s\n\r\t ]+/,
        except: /^\s*Except\s*/
    }
    let keys = Object.keys(tokenTypes);
    let currentCourse: string | null = null;
    while (expression) {
        if (!keys.some(tokenType => {
            let match = expression.match(tokenTypes[tokenType as keyof typeof tokenTypes]);
            if (match) {
                let value = match[0].trim();
                if (tokenType === "course") {
                    if (match[1]) {
                        currentCourse = match[1];
                    } else {
                        match[1] = currentCourse!;
                    }
                    value = `${match[1]}-${match[2]}`;
                }
                tokens.push({ type: tokenType, value });
                expression = expression.substring(match[0].length);
                return true;
            }
            return false;
        })) {
            throw `Unrecognized token type: ${expression} in expression ${original}`;
        }
    }

    return tokens;
}