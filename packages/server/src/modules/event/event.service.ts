import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { InteractionType } from 'src/common/enums/event.enum';
import { User } from 'src/generated/prisma/client';
import { ActionType } from 'src/generated/prisma/client';

@Injectable()
export class EventService {
    constructor(private prisma: PrismaService) { }

    async addEvent(event: CreateEventDto) {
        if (!(await this.prisma.eventType.findUnique({
            where: {
                Id: event.EventTypeId,
            }
        }))) throw new NotFoundException(`Event type id '${event.EventTypeId}' does not exist.`);

        const trackingRule = await this.prisma.trackingRule.findUnique({
            where: {
                Id: event.TrackingRuleId,
            }
        })

        if (!trackingRule) throw new NotFoundException(`Tracking rule id '${event.TrackingRuleId}' does not exist.`);

        const domain = await this.prisma.domain.findUnique({
            where: {
                Id: trackingRule.DomainID,
            }
        })

        if (!domain) throw new NotFoundException(`Domain ID '${trackingRule.DomainID}' does not exist.`);

        // let user = await this.prisma.user.findUnique({
        //     where:
        //         event.UserField === UserField.USERNAME
        //             ? { Username_DomainId: { Username: event.UserValue, DomainId: domain.Id } }
        //             : {
        //                 DomainId_DomainUserId: {
        //                     DomainUserId: event.UserValue,
        //                     DomainId: domain.Id
        //                 }
        //             }
        // });

        // if (!user) {
        //     user = await this.prisma.user.create({
        //         data:
        //             event.UserField === UserField.USERNAME
        //                 ? { Username: event.UserValue, DomainId: domain.Id, CreatedAt: new Date() }
        //                 : {
        //                     DomainUserId: event.UserValue,
        //                     DomainId: domain.Id
        //             }
        //     });
        // }

        let user: User | null = null;

        // if (event.UserId)
        // {
        //     if (event.AnonymousId)
        //     {
        //         user = await this.prisma.user.findUnique({
        //             where: {
        //                 AnonymousId_UserId_DomainId: {
        //                     AnonymousId: event.AnonymousId,
        //                     UserId: event.UserId,
        //                     DomainId: domain.Id,
        //                 }
        //             }
        //         });
        //         if (!user)
        //         {
        //             user = await this.prisma.user.create({
        //                 data: {
        //                     AnonymousId: event.AnonymousId,
        //                     UserId: event.UserId,
        //                     DomainId: domain.Id,
        //                     CreatedAt: new Date(),
        //                 }
        //             });
        //         }
        //     } else {
        //         user = await this.prisma.user.findFirst({
        //             where: {
        //                 UserId: event.UserId,
        //                 DomainId: domain.Id,
        //             }
        //         });
        //         if (!user)
        //         {
        //             user = await this.prisma.user.create({
        //                 data: {
        //                     UserId: event.UserId,
        //                     DomainId: domain.Id,
        //                     CreatedAt: new Date(),
        //                 }
        //             });
        //         }
        //     }
        // } else {
        //     user = await this.prisma.user.findFirst({
        //         where: {
        //             AnonymousId: event.AnonymousId,
        //             DomainId: domain.Id,
        //         }
        //     });
        //     if (!user)
        //     {
        //         user = await this.prisma.user.create({
        //             data: {
        //                 AnonymousId: event.AnonymousId,
        //                 DomainId: domain.Id,
        //                 CreatedAt: new Date(),
        //             }
        //         });
        //     }
        // }

        if (event.UserId)
        {
            user = await this.prisma.user.findFirst({
                where: {
                    UserId: event.UserId,
                    DomainId: domain.Id,
                }
            });
            if (!user)
            {
                user = await this.prisma.user.create({
                    data: {
                        UserId: event.UserId,
                        DomainId: domain.Id,
                        CreatedAt: new Date(),
                    }
                });
            }
        } else if (event.AnonymousId) {
            user = await this.prisma.user.findFirst({
                where: {
                    AnonymousId: event.AnonymousId,
                    DomainId: domain.Id,
                }
            });
            if (!user)
            {
                user = await this.prisma.user.create({
                    data: {
                        AnonymousId: event.AnonymousId,
                        DomainId: domain.Id,
                        CreatedAt: new Date(),
                    }
                });
            }
        } else {
            throw new BadRequestException(`There must be UserId or AnonymousId`);
        }
        
        const item = await this.prisma.item.findUnique({
            where: {
                DomainId_DomainItemId: {
                    DomainId: domain.Id,
                    DomainItemId: event.ItemId
                }
            }
        });

        if (!item) throw new NotFoundException(`Item with id ${event.ItemId} does not exist in domain ${domain.Id}`);


        // let targetItemIds: number[] = [];
        // if (event.ItemField === ItemField.ITEM_ID) {
            // const item = await this.prisma.item.findUnique({
            //     where: {
            //         DomainId_DomainItemId: {
            //             DomainId: domain.Id,
            //             DomainItemId: event.ItemValue,
            //         }
            //     }
            // })
        //     if (!item) throw new NotFoundException(`Item id '${event.ItemValue}' does not exist in domain ${domain.Id}.`);
        //     targetItemIds.push(item.Id);
        // }
        // if (event.ItemField === ItemField.ITEM_TITLE) {
        //     const items = await this.prisma.item.findMany({
        //         where: {
        //             Title: event.ItemValue,
        //             DomainId: domain.Id,
        //         }
        //     })
        //     if (!items.length) throw new NotFoundException(`Item title '${event.ItemValue}' does not exist.`);
        //     targetItemIds.push(...items.map(item => item.Id));
        // }

        const createdEvent = await this.prisma.event.create({
            data: {
                EventTypeId: event.EventTypeId,
                UserId: event.UserId ? event.UserId : null,
                ItemId: event.ItemId,
                AnonymousId: event.AnonymousId,
                RatingValue: event.RatingValue,
                ReviewValue: event.RatingReview,
                Timestamp: new Date(new Date(event.Timestamp).toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })),
                TrackingRuleId: event.TrackingRuleId,
            }
        });

        // 2 rate 3 review
        if (event.EventTypeId === 2) {
            if (event.RatingValue === null || event.RatingValue === undefined) throw new BadRequestException(`Rating value is required for rating events.`);
            if (event.RatingValue < 1 || event.RatingValue > 5) throw new BadRequestException(`Rating value must be between 1 and 5.`);

            // let validItemIds: number[] = [];
            // for (const itemId of targetItemIds) {
            //     const exist = await this.prisma.rating.findUnique({
            //         where: {
            //             UserId_ItemId: {
            //                 UserId: user.Id,
            //                 ItemId: itemId,
            //             }
            //         }
            //     })
            //     if (!exist) validItemIds.push(itemId);
            // }

            const rating = await this.prisma.rating.findUnique({
                where: {
                    UserId_ItemId: {
                        UserId: user.Id,
                        ItemId: item.Id,
                    }
                }
            });

            if (!rating) {
                await this.prisma.rating.create({
                    data: {
                        UserId: user.Id,
                        ItemId: item.Id,
                        Value: event.RatingValue,
                        ReviewText: event.RatingReview,
                        CreatedAt: event.Timestamp,
                        DomainId: domain.Id,
                    }
                });
            } else {
                await this.prisma.rating.update({
                    where: {
                        Id: rating.Id,
                    },
                    data: {
                        Value: event.RatingValue,
                        CreatedAt: event.Timestamp,
                    }
                });
            }
        }
        else if (event.EventTypeId === 3) {
            if (event.RatingReview === null || event.RatingReview === undefined) throw new BadRequestException(`Rating review is required for review events.`);

            // let validItemIds: number[] = [];
            // for (const itemId of targetItemIds) {
            //     const exist = await this.prisma.rating.findUnique({
            //         where: {
            //             UserId_ItemId: {
            //                 UserId: user.Id,
            //                 ItemId: itemId,
            //             }
            //         }
            //     })
            //     if (!exist) validItemIds.push(itemId);
            // }

            const rating = await this.prisma.rating.findUnique({
                where: {
                    UserId_ItemId: {
                        UserId: user.Id,
                        ItemId: item.Id,
                    }
                }
            });

            if (!rating) {
                await this.prisma.rating.create({
                    data: {
                        UserId: user.Id,
                        ItemId: item.Id,
                        ReviewText: event.RatingReview,
                        CreatedAt: event.Timestamp,
                        DomainId: domain.Id,
                    }
                });
            } else {
                await this.prisma.rating.update({
                    where: {
                        Id: rating.Id,
                    },
                    data: {
                        ReviewText: event.RatingReview,
                        CreatedAt: event.Timestamp,
                    }
                });
            }
        }
        // click --> action type
        else if (event.EventTypeId === 1) {
            let interactionType: number;
            if (!trackingRule.ActionType) throw new BadRequestException(`Tracking rule '${trackingRule.Id}' does not have action type defined.`);
            switch (trackingRule.ActionType) {
                case ActionType.View:
                    interactionType = InteractionType.View;
                    break;
                case ActionType.AddToFavorite:
                    interactionType = InteractionType.AddToFavorite;
                    break;
                case ActionType.AddToWishlist:
                    interactionType = InteractionType.AddToWishlist;
                    break;
                case ActionType.AddToCart:
                    interactionType = InteractionType.AddToCart;
                    break;
                case ActionType.Purchase:
                    interactionType = InteractionType.Purchase;
                    break;
                case ActionType.Submit:
                    interactionType = InteractionType.Submit;
                    break;
            }
            const exist = await this.prisma.interaction.findUnique({
                where: {
                    UserId_ItemId_InteractionTypeId: {
                        UserId: user.Id,
                        ItemId: item.Id,
                        InteractionTypeId: interactionType,
                    }
                }
            })
            if (exist) return;

            await this.prisma.interaction.create({
                data: {
                    UserId: user.Id,
                    ItemId: item.Id,
                    InteractionTypeId: interactionType,
                    CreatedAt: event.Timestamp,
                    DomainId: domain.Id,
                }
            });
        }
        else {
            const exist = await this.prisma.interaction.findUnique({
                where: {
                    UserId_ItemId_InteractionTypeId: {
                        UserId: user.Id,
                        ItemId: item.Id,
                        InteractionTypeId: event.EventTypeId,
                    }
                }
            })
            if (!exist) return;

            await this.prisma.interaction.create({
                data: {
                    UserId: user.Id,
                    ItemId: item.Id,
                    InteractionTypeId: event.EventTypeId,
                    CreatedAt: event.Timestamp,
                    DomainId: domain.Id,
                }
            });
        }

        

        return createdEvent.Id;
    }
}
