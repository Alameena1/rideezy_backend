import { z } from 'zod';

export const CreateNotificationDto = z.object({
  userId: z.string(),
  message: z.string(),
  type: z.string(),
  isRead: z.boolean().optional().default(false),
  createdAt: z.date().optional().default(() => new Date()),
});

export type CreateNotificationDtoType = z.infer<typeof CreateNotificationDto>;