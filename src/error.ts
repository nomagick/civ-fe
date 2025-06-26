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

                return instance;
            }
            const instance = new CivFeError(`[DOM ${typ}: ${task.type}] ${error}`, { cause: error });
            instance.task = task;

            return instance;
        }

        if (error instanceof Error) {
            return new CivFeError(error.message, { cause: error });
        }

        return new CivFeError(String(error));
    }

}
