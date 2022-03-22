import type { ChainablePromiseElement, ChainablePromiseArray } from 'webdriverio'

import * as allLocatorsTypes from '../locators/1.61.0'
import { ContextMenu } from '..'

type ClassWithFunctionLocatorsAsString<T> = {
    [key in keyof T as T[key] extends Function | undefined ? key : never]: T[key]
}

type ClassWithFunctionLocators$<T> = {
    // @ts-expect-error this fails compiling here but works when applied to a class
    [key in keyof ClassWithFunctionLocatorsAsString<T> as `${key}$`]: (
        // @ts-expect-error this fails compiling here but works when applied to a class
        ...args: Parameters<ClassWithFunctionLocatorsAsString<T>[key]>
    ) => ChainablePromiseElement<WebdriverIO.Element>
}

type ClassWithFunctionLocators$$<T> = {
    // @ts-expect-error this fails compiling here but works when applied to a class
    [key in keyof ClassWithFunctionLocatorsAsString<T> as `${key}$$`]: (
        // @ts-expect-error this fails compiling here but works when applied to a class
        ...args: Parameters<ClassWithFunctionLocatorsAsString<T>[key]>
    ) => ChainablePromiseArray<WebdriverIO.Element[]>
}

type ClassWithLocators$<T> = {
    [key in keyof T & string as T[key] extends String | undefined
        ? `${key}$`
        : never]: ChainablePromiseElement<WebdriverIO.Element>
}
type ClassWithLocators$$<T> = {
    [key in keyof T & string as T[key] extends String | undefined
        ? `${key}$$`
        : never]: ChainablePromiseArray<WebdriverIO.Element[]>
}

type LocatorProperties<T> = {
    readonly locatorMap: AllLocatorType,
    readonly locators: T
}

type AllLocatorType = typeof allLocatorsTypes
export type LocatorComponents = keyof AllLocatorType | (keyof AllLocatorType)[]
export type Locators = Record<string | symbol, string | Function>
export type LocatorMap = Record<keyof AllLocatorType, Locators>
export type IPluginDecorator<T> = (
    ClassWithLocators$<T> & ClassWithLocators$$<T> &
    ClassWithFunctionLocators$<T> & ClassWithFunctionLocators$$<T>
)

export function PluginDecorator<T extends { new(...args: any[]): any }> (locators: Locators) {
    return (ctor: T) => {
        for (const [prop, globalLocator] of Object.entries(locators)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            ctor.prototype.__defineGetter__(`${prop}$`, function (this: LocatorProperties<any> & BasePage<any>) {
                const locator: Locators[string] = this.locators[prop] || globalLocator
                if (typeof locator === 'function') {
                    return (...args: string[]) => this.elem.$(locator(...args) as string)
                }
                return this.elem.$(locator)
            })
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            ctor.prototype.__defineGetter__(`${prop}$$`, function (this: LocatorProperties<any> & BasePage<any>) {
                const locator: Locators[string] = this.locators[prop] || globalLocator
                if (typeof locator === 'function') {
                    return (...args: string[]) => this.elem.$$(locator(...args) as string)
                }
                return this.elem.$$(locator)
            })
        }

        return ctor
    }
}

export abstract class BasePage<T, F extends Record<string, Locators> = LocatorMap> {
    /**
     * @private
     */
    abstract locatorKey: keyof F | (keyof F)[]

    /**
     * @private
     */
    constructor (
        protected _locators: F,
        private _baseElem?: string | ChainablePromiseElement<WebdriverIO.Element>,
        private _parentElem?: string | ChainablePromiseElement<WebdriverIO.Element>
    ) {}

    /**
     * Get the locator map of given page object
     *
     */
    get locators () {
        if (Array.isArray(this.locatorKey)) {
            return this.locatorKey.reduce((prev, locatorKey) => ({
                ...prev,
                ...this._locators[locatorKey as keyof LocatorMap]
            } as Locators), {} as Locators) as any as T
        }
        return this._locators[this.locatorKey as keyof LocatorMap] as any as T
    }

    /**
     * @private
     */
    get baseElem () {
        return this._baseElem
    }

    /**
     * @private
     */
    get locatorMap () {
        return this._locators
    }

    /**
     * Base element of given page object
     */
    get elem () {
        const baseLocator = (this.locators as any as Locators).elem
        if (this._baseElem) {
            return typeof this._baseElem === 'string'
                ? browser.$(this._baseElem)
                : this._baseElem
        }

        if (typeof baseLocator === 'string') {
            return browser.$(baseLocator)
        }

        return browser.$('html')
    }

    /**
     * Parent element of given page object
     */
    get parent () {
        if (this._parentElem) {
            return typeof this._parentElem === 'string'
                ? browser.$(this._parentElem)
                : this._parentElem
        }
        return browser.$('html')
    }

    /**
     * @private
     */
    setParentElement (parentElem: string | ChainablePromiseElement<WebdriverIO.Element>) {
        this._parentElem = parentElem
    }

    /**
     * Wait for the element to become visible
     * @param timeout custom timeout for the wait
     * @returns thenable self reference
     */
    async wait (timeout = 5000): Promise<this> {
        await this.elem.waitForDisplayed({ timeout })
        return this
    }
}

/**
 * Abstract element that has a context menu
 */
export abstract class ElementWithContextMenu<T> extends BasePage<T> {
    /**
     * Open context menu on the element
     */
    async openContextMenu (): Promise<ContextMenu> {
        const contextMenuLocators = this.locatorMap.ContextMenu as AllLocatorType['ContextMenu']
        const workbench = browser.$((this.locatorMap.Workbench as AllLocatorType['Workbench']).elem)
        const menus = await browser.$$(contextMenuLocators.contextView)

        if (menus.length < 1) {
            await this.elem.click({ button: 2 })
            await browser.$(contextMenuLocators.contextView).waitForExist({ timeout: 2000 })
            return new ContextMenu(this.locatorMap, workbench).wait()
        }

        if (await workbench.$$(contextMenuLocators.viewBlock).length > 0) {
            await this.elem.click({ button: 2 })
            await this.elem.waitForDisplayed({ reverse: true, timeout: 1000 })
        }

        await this.elem.click({ button: 2 })
        return new ContextMenu(this.locatorMap).wait()
    }
}
