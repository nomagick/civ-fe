import { TrieRouter } from './lib/trie-router';
import { CivComponent } from './civ-component';
import { runOncePerInstance } from './lib/once';
import { DomConstructionTaskType, NodeGroupToggleTask } from 'dom';

let serial = 0;

type CustomRouteFunction = (this: CivRouter, params: {
    searchParams: URLSearchParams;
    routeParams: Record<string, string>;
}) => Promise<typeof CivComponent | CivComponent>;

type ComponentType = (typeof CivComponent | CivComponent) | CustomRouteFunction | string;

export interface RouterState {
    __type: 'routerState';
    path: string;
    params: URLSearchParams;
    [key: string]: unknown;
}

export interface RouteDefinition {
    path: string;
    component: ComponentType;
    transition?: boolean;
}

export abstract class CivRouter extends CivComponent {

    anchor: Comment;

    trieRouter: TrieRouter<RouteDefinition> = new TrieRouter();

    current?: {
        route: RouteDefinition;
        searchParams: URLSearchParams;
        routeParams: Record<string, string>;
        component?: CivComponent;
    }

    abstract routes: RouteDefinition[];

    constructor() {
        super();
        this.anchor = document.createComment(`===> Civ Router Anchor ${serial++} <===`);
        this.element.appendChild(this.anchor);

        window.addEventListener('popstate', (ev) => {
            const targetUrl = new URL(window.location.href);
            this.goto(targetUrl, !ev.hasUAVisualTransition);
        });

        const abortController = new AbortController();
        this._revokers ??= new Set();
        this._revokers.add(abortController);
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

            if (!target.href || target.target !== '_self' || target.download || target.rel) {
                return;
            }
            const parsed = new URL(target.href, window.location.href);
            if (parsed.origin !== window.location.origin) {
                return;
            }
            ev.preventDefault();
            this.goto(parsed);
        }, { signal: abortController.signal });
    }

    @runOncePerInstance
    protected _register() {
        for (const route of this.routes) {
            this.trieRouter.register(route.path, route);
        }
    }

    async goto(path: string | URL, overrideTransition?: boolean) {
        const targetUrl = typeof path === 'string' ? new URL(path, window.location.href) : path;
        if (targetUrl.origin !== window.location.origin) {
            throw new Error(`Cannot navigate to a different origin: ${targetUrl.origin}`);
        }

        const [matchedRoute] = this.trieRouter.match(targetUrl.pathname);
        if (!matchedRoute) {
            throw new Error(`No route matched for path: ${targetUrl.pathname}`);
        }

        const [route, routeParams] = matchedRoute;

        const previousCurrent = this.current;

        this.current = {
            route,
            searchParams: targetUrl.searchParams,
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

        const transition = overrideTransition ?? this.current.route.transition;

        if ('startViewTransition' in document && transition !== false) {
            document.startViewTransition(async () => {
                try {
                    const component = await loadProcedure();

                    await renderComp(component);
                    history.pushState({
                        __type: 'routerState',
                        params: this.current!.searchParams,
                        path: this.current!.route.path,
                    }, '', targetUrl);
                } catch (err) {
                    console.error('Error loading component:', err);
                    throw err;
                }
            });
            return;
        }

        try {
            const component = await loadProcedure();

            await renderComp(component);
            history.pushState({
                __type: 'routerState',
                params: this.current!.searchParams,
                path: this.current!.route.path,
            }, '', targetUrl);
        } catch (err) {
            console.error('Error loading component:', err);
            throw err;
        }
    }


}
