import { randomUUID } from "crypto";

// NOTE: Tickets are stored in-memory. In a multi-instance deployment,
// move this to Redis (or another shared store) so that a ticket issued
// by one server instance can be consumed by another.

interface Ticket {
  userId: string;
  expiresAt: number;
}

const tickets = new Map<string, Ticket>();
const ticketCountByUser = new Map<string, number>();

const TICKET_TTL_MS = 30_000; // 30 seconds
const MAX_TICKETS_PER_USER = 5;

export function issueTicket(userId: string): string {
  const count = ticketCountByUser.get(userId) ?? 0;
  if (count >= MAX_TICKETS_PER_USER) {
    throw new Error("Too many outstanding tickets");
  }
  const id = randomUUID();
  tickets.set(id, { userId, expiresAt: Date.now() + TICKET_TTL_MS });
  ticketCountByUser.set(userId, count + 1);
  return id;
}

export function consumeTicket(ticketId: string): string | null {
  const ticket = tickets.get(ticketId);
  if (!ticket) return null;
  tickets.delete(ticketId);
  const n = (ticketCountByUser.get(ticket.userId) ?? 1) - 1;
  if (n <= 0) ticketCountByUser.delete(ticket.userId);
  else ticketCountByUser.set(ticket.userId, n);
  if (Date.now() > ticket.expiresAt) return null;
  return ticket.userId;
}

// Periodic cleanup of expired tickets
setInterval(() => {
  const now = Date.now();
  for (const [id, ticket] of tickets) {
    if (now > ticket.expiresAt) {
      tickets.delete(id);
      const n = (ticketCountByUser.get(ticket.userId) ?? 1) - 1;
      if (n <= 0) ticketCountByUser.delete(ticket.userId);
      else ticketCountByUser.set(ticket.userId, n);
    }
  }
}, 60_000);
