import { z } from "zod";
export declare const agentsRouter: import("@trpc/server").TRPCBuiltRouter<{
    ctx: {
        db: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof import("@sanotalk/db/schema")> & {
            $client: import("postgres").Sql<{}>;
        };
        session: {
            session: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined | undefined;
                userAgent?: string | null | undefined | undefined;
            };
            user: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined | undefined;
            };
        } | null;
        user: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined | undefined;
        } | null;
        req: import("http").IncomingMessage;
        res: import("http").ServerResponse<import("http").IncomingMessage>;
    };
    meta: object;
    errorShape: {
        data: {
            zodError: z.typeToFlattenedError<any, string> | null;
            code: import("@trpc/server").TRPC_ERROR_CODE_KEY;
            httpStatus: number;
            path?: string;
            stack?: string;
        };
        message: string;
        code: import("@trpc/server").TRPC_ERROR_CODE_NUMBER;
    };
    transformer: true;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    generateSummary: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            sessionId: string;
        };
        output: {
            id: string;
            status: "pending" | "running" | "success" | "error";
            startedAt: Date | null;
            sessionId: string | null;
            agentName: string;
            input: unknown;
            output: unknown;
            errorMessage: string | null;
            completedAt: Date | null;
        } | undefined;
        meta: object;
    }>;
    runStatus: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            runId: string;
        };
        output: {
            id: string;
            status: "pending" | "running" | "success" | "error";
            startedAt: Date | null;
            sessionId: string | null;
            agentName: string;
            input: unknown;
            output: unknown;
            errorMessage: string | null;
            completedAt: Date | null;
        } | undefined;
        meta: object;
    }>;
}>>;
//# sourceMappingURL=agents.d.ts.map