import { Matches } from 'class-validator';

export class ConfirmCheckoutDto {
  /** The `session_id` Stripe appends to the success URL. */
  @Matches(/^cs_test_\w+$/, { message: 'Session id is not valid' })
  sessionId: string;
}
