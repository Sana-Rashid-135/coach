import dotenv from 'dotenv';
dotenv.config();

import Twilio from 'twilio';

export type ParsedIncomingMessage = {
  from: string;
  body: string;
  message_sid: string;
  profile_name: string;
  wa_id: string;
};

export class TwilioService {
  private client: Twilio.Twilio;
  private whatsappNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || '';

    if (!accountSid || !authToken || !this.whatsappNumber) {
      throw new Error('Twilio credentials must be set in environment variables');
    }

    this.client = Twilio(accountSid, authToken);
  }

  async sendWhatsAppMessage(to: string, message: string): Promise<string | null> {
    try {
      let cleanPhone = to.replace('whatsapp:', '').replace(/\s+/g, '').trim();
      if (!cleanPhone.startsWith('+')) cleanPhone = `+${cleanPhone}`;
      const toWhatsApp = `whatsapp:${cleanPhone}`;

      const msg = await this.client.messages.create({
        body: message,
        from: this.whatsappNumber,
        to: toWhatsApp,
      });

      console.log(`Message sent successfully: ${msg.sid}`);
      return msg.sid;
    } catch (err) {
      console.error('Error sending WhatsApp message:', err);
      return null;
    }
  }

  parseIncomingMessage(requestData: Record<string, string | undefined>): ParsedIncomingMessage {
    try {
      return {
        from: requestData['From'] || '',
        body: requestData['Body'] || '',
        message_sid: requestData['MessageSid'] || '',
        profile_name: requestData['ProfileName'] || '',
        wa_id: requestData['WaId'] || '',
      };
    } catch (err) {
      console.error('Error parsing incoming message:', err);
      return { from: '', body: '', message_sid: '', profile_name: '', wa_id: '' };
    }
  }
}

export const twilioService = new TwilioService();


