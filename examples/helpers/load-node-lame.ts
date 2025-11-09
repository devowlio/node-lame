type NodeLameModule = typeof import("../../src/index");

const MODULE_NOT_FOUND_CODE = "ERR_MODULE_NOT_FOUND";
const LOCAL_FALLBACKS = ["../../src/index.ts", "../../dist/index.cjs"] as const;

type ErrorWithCode = {
    code?: string;
};

const isModuleNotFoundError = (
    error: unknown,
): error is ErrorWithCode => {
    if (typeof error !== "object" || error === null) {
        return false;
    }

    return (
        "code" in error &&
        (error as ErrorWithCode).code === MODULE_NOT_FOUND_CODE
    );
};

const resolveLocalModule = async (): Promise<NodeLameModule> => {
    for (const relativePath of LOCAL_FALLBACKS) {
        try {
            const moduleUrl = new URL(relativePath, import.meta.url);
            return (await import(moduleUrl.href)) as unknown as NodeLameModule;
        } catch (error) {
            if (isModuleNotFoundError(error)) {
                continue;
            }

            throw error;
        }
    }

    throw new Error(
        'node-lame: Unable to locate local sources. Run "pnpm build" or ensure src/ is available.',
    );
};

const loadNodeLame = async (): Promise<NodeLameModule> => {
    try {
        return (await import("node-lame")) as unknown as NodeLameModule;
    } catch (error) {
        if (isModuleNotFoundError(error)) {
            return resolveLocalModule();
        }

        throw error;
    }
};

const nodeLame = await loadNodeLame();

export const { Lame, LameStream } = nodeLame;
export default nodeLame;
