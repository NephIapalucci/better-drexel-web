import { CompletionState, DegreeCourse } from "./degreeworks";
import * as drexel from "drexel";

export class Account {

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

export function completionStyleFor(completion: CompletionState) {
    switch (completion) {
        case "Incomplete (Ready to take)": return { brightColor: "#888899", darkColor: "#8888CC", text: "–" };
        case "Incomplete (missing prerequisites)": return { brightColor: "#FF8888", darkColor: "#CC8888", text: "✕" };
        case "Complete": return { brightColor: "#88FF88", darkColor: "#88CC88", text: "✓" };
        case "In Progress": return { brightColor: "#FFFF88", darkColor: "#CCCC88", text: "≈" };
    }
}