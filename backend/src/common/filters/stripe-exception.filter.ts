import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import Stripe from 'stripe';

// Errors from the Stripe SDK (bad key, network problem, unknown session)
// would otherwise surface as a generic 500.
@Catch(Stripe.errors.StripeError)
export class StripeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Stripe');

  catch(error: Stripe.errors.StripeError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (error.code === 'resource_missing') {
      response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Checkout session not found',
      });
      return;
    }

    this.logger.error(`${error.type}: ${error.message}`);
    response.status(HttpStatus.BAD_GATEWAY).json({
      statusCode: HttpStatus.BAD_GATEWAY,
      message:
        'The payment provider could not process the request. Please try again.',
    });
  }
}
