import { BadRequestException, Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('event')
export class EventController {
    constructor(private eventService: EventService) { }

    @Post()
    async addEvent(@Body() body: CreateEventDto) {
        const result = await this.eventService.addEvent(body);

        return {
            statusCode: 201,
            message: 'Event was created successfully',
            eventId: result,
        };
    }
}
