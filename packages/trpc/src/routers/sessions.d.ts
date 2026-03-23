import { z } from "zod";
export declare const sessionsRouter: import("@trpc/server").TRPCBuiltRouter<{
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
    list: import("@trpc/server").TRPCQueryProcedure<{
        input: void;
        output: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: "scheduled" | "active" | "completed" | "cancelled";
            roomName: string;
            hostId: string;
            scheduledAt: Date | null;
            startedAt: Date | null;
            endedAt: Date | null;
            participants: never;
        }[];
        meta: object;
    }>;
    byId: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            id: string;
        };
        output: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: "scheduled" | "active" | "completed" | "cancelled";
            roomName: string;
            hostId: string;
            scheduledAt: Date | null;
            startedAt: Date | null;
            endedAt: Date | null;
            participants: never;
        };
        meta: object;
    }>;
    create: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            scheduledAt?: string | undefined;
        };
        output: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: "scheduled" | "active" | "completed" | "cancelled";
            roomName: string;
            hostId: string;
            scheduledAt: Date | null;
            startedAt: Date | null;
            endedAt: Date | null;
        } | undefined;
        meta: object;
    }>;
    start: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            id: string;
        };
        output: {
            id: string;
            status: "scheduled" | "active" | "completed" | "cancelled";
            roomName: string;
            hostId: string;
            scheduledAt: Date | null;
            startedAt: Date | null;
            endedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        } | undefined;
        meta: object;
    }>;
    end: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            id: string;
        };
        output: {
            id: string;
            status: "scheduled" | "active" | "completed" | "cancelled";
            roomName: string;
            hostId: string;
            scheduledAt: Date | null;
            startedAt: Date | null;
            endedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        } | undefined;
        meta: object;
    }>;
}>>;
//# sourceMappingURL=sessions.d.ts.map