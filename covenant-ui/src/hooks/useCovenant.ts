import { useState, useEffect, useCallback } from 'react';
import { ethers, Contract } from 'ethers';
import { useWeb3Context } from '../contexts/Web3Context';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants';
import type { Task } from '../types';
import { TaskStatus } from '../types';

export function useCovenant() {
    const { provider, signer } = useWeb3Context();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const getContract = useCallback(() => {
        if (!provider) return null;
        return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    }, [provider]);

    const getSignedContract = useCallback(async () => {
        if (!signer) return null;
        return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }, [signer]);

    const fetchTasks = useCallback(async () => {
        const contract = getContract();
        if (!contract) return;

        try {
            const total = await contract.getTotalTasks();
            const count = Number(total);

            const loadedTasks: Task[] = [];
            // Fetch last 10 tasks (newest first)
            for (let i = count - 1; i >= Math.max(0, count - 10); i--) {
                const t = await contract.getTask(i);
                loadedTasks.push({
                    id: i,
                    creator: t.creator,
                    executor: t.executor,
                    verifier: t.verifier,
                    escrowAmount: ethers.formatEther(t.escrowAmount),
                    status: Number(t.status) as TaskStatus,
                    taskData: t.taskData,
                    resultHash: t.resultHash,
                    verdict: t.verdict,
                    timestamp: Number(t.createdAt)
                });
            }
            setTasks(loadedTasks);
        } catch (e) {
            console.error("Error fetching tasks:", e);
        }
    }, [getContract]);

    // Initial fetch + polling
    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 3000); // Fast polling for demo
        return () => clearInterval(interval);
    }, [fetchTasks]);

    const createTask = async (inputStr: string, amount: string, verifierAddress?: string) => {
        setIsLoading(true);
        try {
            const contract = await getSignedContract();
            if (!contract) throw new Error("Wallet not connected");

            // Default verifier (Account #2 from Hardhat)
            const verifier = verifierAddress || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

            // Generate valid bytes32 from input string
            let taskData: string;
            if (inputStr.startsWith('0x') && inputStr.length === 66) {
                taskData = inputStr;
            } else {
                // Hash the input to get 32 bytes
                taskData = ethers.keccak256(ethers.toUtf8Bytes(inputStr));
            }

            const tx = await contract.createTask(verifier, taskData, {
                value: ethers.parseEther(amount)
            });

            await tx.wait();
            fetchTasks();
        } finally {
            setIsLoading(false);
        }
    };

    return { tasks, createTask, isLoading };
}
