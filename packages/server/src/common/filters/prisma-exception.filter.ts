import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpStatus,
    HttpException,
} from '@nestjs/common';

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();

        // Nếu là HttpException (UnauthorizedException, NotFoundException, etc.), pass through
        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            return response.status(status).json(exceptionResponse);
        }

        // Handle Prisma errors
        if (exception.code && exception.clientVersion) {
            switch (exception.code) {
                case 'P2002': // Unique constraint
                    const fields = exception.meta?.target
                        ? Array.isArray(exception.meta.target)
                            ? exception.meta.target.join(', ')
                            : exception.meta.target
                        : 'unknown';
                    return response.status(HttpStatus.CONFLICT).json({
                        statusCode: HttpStatus.CONFLICT,
                        message: `Unique constraint failed on field(s): ${fields}`,
                    });

                case 'P2003': // Foreign key fail
                    return response.status(HttpStatus.BAD_REQUEST).json({
                        statusCode: HttpStatus.BAD_REQUEST,
                        message: 'Foreign key constraint failed',
                    });

                case 'P2025': // Record not found
                    return response.status(HttpStatus.NOT_FOUND).json({
                        statusCode: HttpStatus.NOT_FOUND,
                        message: 'Record not found',
                    });

                default:
                    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                        message: `Database error: ${exception.code}`,
                    });
            }
        }

        // Handle Prisma validation errors
        if (exception.name === 'PrismaClientValidationError') {
            return response.status(HttpStatus.BAD_REQUEST).json({
                statusCode: HttpStatus.BAD_REQUEST,
                message: 'Validation error',
            });
        }

        // Unknown errors
        console.error('Unhandled exception:', exception);
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Internal server error',
        });
    }
}