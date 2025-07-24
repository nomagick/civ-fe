import { TrieRouter } from './lib/trie-router';
import { CivComponent } from './civ-component';
import { runOncePerInstance } from './lib/once';
import { DomConstructionTaskType, NodeGroupToggleTask } from './dom';
import { setImmediate } from 'lib/lang';

let serial = 0;

type CustomRouteFunction = (this: CivRouter, params: {
    searchParams?: URLSearchParams;
    routeParams?: Record<string, unknown>;
}) => Promise<typeof CivComponent | CivComponent>;

type ComponentType = (typeof CivComponent | CivComponent) | CustomRouteFunction | string;

export interface RouterState {
    __type: 'routerState';
    path?: string;
    name?: string;
    [key: string]: unknown;
}

export interface RouteDefinition {
    name?: string;
    path?: string;
    component: ComponentType;
    transition?: boolean;
}

export abstract class CivRouter extends CivComponent {

    anchor: Comment;

    trieRouter: TrieRouter<RouteDefinition> = new TrieRouter();

    current?: {
        route: RouteDefinition;
        searchParams?: URLSearchParams;
        routeParams?: Record<string, unknown>;
        component?: CivComponent;
    }

    abstract routes: RouteDefinition[];

    constructor() {
        super();
        this.anchor = document.createComment(`===> Civ Router Anchor ${serial++} <===`);
        this.element.appendChild(this.anchor);

        const abortController = new AbortController();
        this._revokers ??= new Set();
        this._revokers.add(abortController);

        window.addEventListener('popstate', (ev) => {
            const targetUrl = new URL(window.location.href);
            if (ev.state && ev.state.__type === 'routerState') {
                if (ev.state.path) {
                    this.gotoPath(targetUrl, {
                        overrideTransition: !ev.hasUAVisualTransition,
                        state: 'ignore',
                    });
                }
            }
        }, { signal: abortController.signal });
        document.addEventListener('click', (ev) => {
            const target = ev.target as HTMLAnchorElement;
            if (target.tagName !== 'A') {
                return;
            }
            // don't redirect with control keys
            if (ev.metaKey || ev.altKey || ev.ctrlKey || ev.shiftKey) return;
            // don't redirect when preventDefault called
            if (ev.defaultPrevented) return;
            // don't redirect on right click
            if (ev.button !== undefined && ev.button !== 0) return;

            if (!target.href || target.target || target.download || target.rel) {
                return;
            }
            const parsed = new URL(target.href, window.location.href);
            if (parsed.origin !== window.location.origin) {
                return;
            }
            ev.preventDefault();
            this.gotoPath(parsed);
        }, { signal: abortController.signal });

        setImmediate(() => {
            this._register();
            this.gotoPath(window.location.href, {
                overrideTransition: false,
                state: 'replace',
            });
        });
    }

    @runOncePerInstance
    protected _register() {
        for (const route of this.routes) {
            if (route.path) {
                this.trieRouter.register(route.path, route);
            }
        }
    }

    protected prepareGoto(target: {
        path?: string | URL;
        name?: string;
        routeParams?: Record<string, unknown>;
    }) {
        let route: RouteDefinition;
        let routeParams: Record<string, unknown>;
        let searchParams: URLSearchParams | undefined;
        let targetUrl: URL | undefined;
        if (target.path) {
            const path = target.path;
            targetUrl = typeof path === 'string' ? new URL(path, window.location.href) : path;
            if (targetUrl.origin !== window.location.origin) {
                throw new Error(`Cannot navigate to a different origin: ${targetUrl.origin}`);
            }
            const [matchedRoute] = this.trieRouter.match(targetUrl.pathname);
            if (!matchedRoute) {
                throw new Error(`No route matched for path: ${targetUrl.pathname}`);
            }
            searchParams = targetUrl.searchParams;
            [route, routeParams] = matchedRoute;
        } else if (target.name) {
            const matchedRoute = this.routes.find((r) => r.name === target.name);
            if (!matchedRoute) {
                throw new Error(`No route matched for name: ${target.name}`);
            }
            route = matchedRoute;
            routeParams = target.routeParams || {};
        } else {
            throw new Error('Either path or name must be provided to navigate');
        }


        const previousCurrent = this.current;

        this.current = {
            route,
            searchParams,
            routeParams,
        };

        const renderComp = async (component: ComponentType) => {
            if (component instanceof CivComponent) {
                this.current!.component = component;
            } else if ((component as typeof CivComponent).prototype instanceof CivComponent || component === CivComponent) {
                this.current!.component = Reflect.construct(component as typeof CivComponent, []);
            } else {
                throw new Error(`Invalid component type for route: ${typeof component}`);
            }

            const rest = [];
            if (previousCurrent?.component) {
                rest.push(previousCurrent.component.element);
            }
            const task: NodeGroupToggleTask = {
                type: DomConstructionTaskType.GROUP_TOGGLE,
                anchor: this.anchor,
                chosen: this.current!.component.element,
                rest,
            }
            this._setConstruction(task, task);
            this._digestTasks();

            return new Promise<void>((resolve, _reject) => {
                window.addEventListener('tick', () => {
                    resolve();
                }, { once: true });
            });
        };

        let loadProcedure: () => Promise<CivComponent | typeof CivComponent> = () => Promise.resolve(route.component as CivComponent | typeof CivComponent);

        if (typeof route.component === 'function' && !((route.component as typeof CivComponent).prototype instanceof CivComponent)) {
            loadProcedure = () => {
                return (route.component as CustomRouteFunction).call(this, this.current!);
            };
        } else if (typeof route.component === 'string') {
            loadProcedure = async () => {
                const result = (await import(route.component as string)).default;

                if (typeof result === 'function' && !((result as typeof CivComponent).prototype instanceof CivComponent)) {
                    return (result as CustomRouteFunction).call(this, this.current!);
                }

                return result;
            };
        }

        return {
            targetUrl,
            renderComp,
            loadProcedure,
            previousCurrent,
        }
    }

    async gotoPath(path: string | URL, options: {
        overrideTransition?: boolean,
        state?: 'push' | 'replace' | 'ignore'
    } = {}) {
        const { overrideTransition, state = 'push' } = options;
        const { targetUrl, renderComp, loadProcedure } = this.prepareGoto({ path });
        const transition = overrideTransition ?? this.current!.route.transition;

        if ('startViewTransition' in document && transition !== false) {
            return new Promise((resolve, reject) => {
                document.startViewTransition(async () => {
                    try {
                        const component = await loadProcedure();

                        await renderComp(component);
                        if (state === 'push') {
                            history.pushState({
                                __type: 'routerState',
                                path: this.current!.route.path,
                            }, '', targetUrl);
                        } else if (state === 'replace') {
                            history.replaceState({
                                __type: 'routerState',
                                path: this.current!.route.path,
                            }, '', targetUrl);
                        }
                        resolve(this.current);
                    } catch (err) {
                        reject(err);
                    }
                });
            });
        }

        const component = await loadProcedure();

        await renderComp(component);
        if (state === 'push') {
            history.pushState({
                __type: 'routerState',
                path: this.current!.route.path,
            }, '', targetUrl);
        } else if (state === 'replace') {
            history.replaceState({
                __type: 'routerState',
                path: this.current!.route.path,
            }, '', targetUrl);
        }
        return this.current;
    }

    async gotoName(name: string, params?: Record<string, unknown>, options: {
        overrideTransition?: boolean,
        state?: 'push' | 'replace' | 'ignore'
    } = {}) {
        const { overrideTransition, state = 'push' } = options;
        const { targetUrl, renderComp, loadProcedure } = this.prepareGoto({
            name,
            routeParams: params,
        });
        const transition = overrideTransition ?? this.current!.route.transition;

        if ('startViewTransition' in document && transition !== false) {
            return new Promise((resolve, reject) => {
                document.startViewTransition(async () => {
                    try {
                        const component = await loadProcedure();

                        await renderComp(component);
                        if (state === 'push') {
                            history.pushState({
                                __type: 'routerState',
                                name,
                            }, '', targetUrl);
                        } else if (state === 'replace') {
                            history.replaceState({
                                __type: 'routerState',
                                name,
                            }, '', targetUrl);
                        }
                        resolve(this.current);
                    } catch (err) {
                        reject(err);
                    }
                });
            });
        }

        const component = await loadProcedure();

        await renderComp(component);
        if (state === 'push') {
            history.pushState({
                __type: 'routerState',
                name,
            }, '', targetUrl);
        } else if (state === 'replace') {
            history.replaceState({
                __type: 'routerState',
                name,
            }, '', targetUrl);
        }
        return this.current;
    }


}
