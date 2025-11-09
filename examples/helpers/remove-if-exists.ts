import { unlink } from "node:fs/promises";

type ErrorWithCode = {
    code?: string;
};

const isEnoentError = (error: unknown): error is ErrorWithCode => {
    if (typeof error !== "object" || error === null) {
        return false;
    }

    return "code" in error && (error as ErrorWithCode).code === "ENOENT";
};

const removeIfExists = async (filePath: string): Promise<void> => {
    try {
        await unlink(filePath);
    } catch (error) {
        if (isEnoentError(error)) {
            return;
        }

        throw error;
    }
};

export { removeIfExists };
