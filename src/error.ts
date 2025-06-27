import { DomConstructionTask, DomMaintenanceTask, DomConstructionTaskType, DomMaintenanceTaskType } from './dom';

export class CivFeError extends Error {

    task?: DomMaintenanceTask | DomConstructionTask;

    static from(error: unknown, task?: DomMaintenanceTask | DomConstructionTask): CivFeError {
        if (error instanceof CivFeError) {
            return error;
        }

        if (task) {
            const typ = task.type in DomMaintenanceTaskType ? 'Maintenance' :
                task.type in DomConstructionTaskType ? 'Construction' :
                    'Unknown';

            if (error instanceof Error) {
                const instance = new CivFeError(`[DOM ${typ}: ${task.type}] ${error.message}`, { cause: error });
                instance.task = task;
                if ('captureStackTrace' in Error) {
                    // @ts-ignore
                    Error.captureStackTrace(instance, this.from);
                }
                return instance;
            }
            const instance = new CivFeError(`[DOM ${typ}: ${task.type}] ${error}`, { cause: error });
            instance.task = task;
            // @ts-ignore
            Error.captureStackTrace(instance, this.from);

            return instance;
        }

        if (error instanceof Error) {
            const instance = new CivFeError(error.message, { cause: error });
            // @ts-ignore
            Error.captureStackTrace(instance, this.from);
            return instance;
        }

        const instance = new CivFeError(String(error));

        // @ts-ignore
        Error.captureStackTrace(instance, this.from);
        return instance;
    }

}
