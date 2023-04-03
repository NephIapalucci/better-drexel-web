declare module "*?raw";
declare module "*.png";

interface ObjectConstructor {
    keys<T extends { [key: string]: unknown }>(value: T): (keyof T)[];
}