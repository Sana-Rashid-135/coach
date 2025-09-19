import { Router, Request, Response } from 'express';
import { twilioService } from '../services/twilio';
import { openAIService } from '../services/openai';
import { db } from '../services/db';

export const webhookRouter = Router();

export const handleWhatsAppWebhook = async (req: Request, res: Response): Promise<Response> => {
  try {
    const messageData = twilioService.parseIncomingMessage(req.body as Record<string, string>);
    if (!messageData.from || !messageData.body) {
      return res.status(400).json({ error: 'Invalid message data' });
    }

    const phone = messageData.from;
    const messageBody = messageData.body;
    console.log(`Received message from ${phone}: ${messageBody}`);

    let user = await db.getUserByPhone(phone);
    if (!user) {
      const name = (messageData.profile_name || '').trim();
      user = await db.createUser(phone, name ? name : null);
    }

    await db.logMessage(user.id, 'inbound', messageBody);

    let checkin = openAIService.parseMorningCheckin(messageBody);
    let responseMessage: string;

    if (!checkin) {
      checkin = await openAIService.parseMorningCheckinFlexible(messageBody);
    }

    if (checkin) {
      const today = new Date().toISOString().slice(0, 10);
      await db.createDailyLog(user.id, today, checkin);
      const dailyPlan = await openAIService.generateDailyPlan(checkin, user.name || undefined);
      await db.createDailyLog(user.id, today, null, { daily_plan: dailyPlan });
      responseMessage = `Good morning! Here's your personalized daily plan:\n\n${dailyPlan}`;
    } else {
      responseMessage = await openAIService.generateGeneralResponse(messageBody, user.name || undefined);
    }

    const messageSid = await twilioService.sendWhatsAppMessage(phone, responseMessage);
    if (messageSid) {
      await db.logMessage(user.id, 'outbound', responseMessage);
      console.log(`Response sent successfully: ${messageSid}`);
    } else {
      console.log('Failed to send response');
    }

    return res.json({ status: 'success', message_sid: messageSid });
  } catch (err) {
    console.error('Error processing webhook:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

webhookRouter.post('/whatsapp', handleWhatsAppWebhook);

webhookRouter.get('/whatsapp', (_req: Request, res: Response) => {
  return res.json({ status: 'WhatsApp webhook endpoint is active' });
});


