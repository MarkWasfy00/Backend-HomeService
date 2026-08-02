import { isProduction } from "../../core/env.js";

/**
 * Sends the OTP to the user's phone.
 *
 * There is no SMS provider wired up yet, so for now the code is printed to the
 * server console - open the terminal running `npm run dev` and you will see it.
 *
 * TODO: replace the body of this function with a real provider call
 * (Twilio, Vonage, or a local Egyptian gateway). Nothing else has to change:
 * this is the only place that knows how a message is delivered.
 */
export async function sendOtpSms(phone: string, otpCode: string) {
  if (isProduction) {
    throw new Error(
      "No SMS provider is configured - implement sendOtpSms before deploying",
    );
  }

  // Salma will work on the SMS provider integration, but for now we just log the code to the console so we can test the flow.

  console.log(`[otp] code for ${phone} is ${otpCode}`);
}
