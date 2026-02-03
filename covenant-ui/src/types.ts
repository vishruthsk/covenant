export type TaskStatus = 0 | 1 | 2 | 3 | 4;

export const TaskStatus = {
    Created: 0,
    Accepted: 1,
    Submitted: 2,
    Verified: 3,
    Resolved: 4,
} as const;

export interface Task {
    id: number;
    creator: string;
    executor: string;
    verifier: string;
    escrowAmount: string; // in ETH
    status: TaskStatus;
    taskData: string;
    resultHash: string;
    verdict: boolean;
    timestamp: number;
}
