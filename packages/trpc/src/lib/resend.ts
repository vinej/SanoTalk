import { Resend } from "resend";

const _resend = new Resend(process.env.RESEND_API_KEY);

const isTesting = process.env.TESTING === "yes";
const testingEmail = process.env.TESTING_EMAIL;

/**
 * Wrapper around resend.emails.send() that redirects all outgoing emails
 * to TESTING_EMAIL when TESTING=yes, so no real recipients are contacted
 * during development or QA.
 */
export const resend = {
  emails: {
    send: (params: Parameters<typeof _resend.emails.send>[0]) => {
      if (isTesting && testingEmail) {
        console.info(`[email] TESTING mode — redirecting to test mailbox`);
        return _resend.emails.send({ ...params, to: testingEmail });
      }
      return _resend.emails.send(params);
    },
  },
};
