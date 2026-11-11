import { Injectable, BadRequestException, Logger } from '@nestjs/common';

const SANDBOX_URL = 'https://devapi.slick-pay.com/api/v2';
const PROD_URL = 'https://prodapi.slick-pay.com/api/v2'; // 👈 هنا السر!

@Injectable()
export class SlickPayService {
  private readonly logger = new Logger(SlickPayService.name);
  private readonly baseUrl: string;
  private readonly publicKey: string;

  constructor() {
    this.publicKey = process.env.SLICKPAY_PUBLIC_KEY ?? '';
    const isSandbox = (process.env.SLICKPAY_SANDBOX ?? 'true') === 'true';
    this.baseUrl = isSandbox ? SANDBOX_URL : PROD_URL;

    if (!this.publicKey) this.logger.warn('SLICKPAY_PUBLIC_KEY is not set');
  }

 private headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${this.publicKey}`,
    Accept: 'application/json',
    'x-business-id': process.env.SLICKPAY_BUSINESS_ID ?? '', 
  };
}

  
   async createInvoice(data: {
    amount: number;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    url: string;
    items: { name: string; price: number; quantity: number }[];
  }) {
    const body = {
      amount: data.amount,
      firstname: data.firstName,
      lastname: data.lastName,
      email: data.email,
      // 👈 إلا كان phone خاوي، نعطيوه رقم افتراضي
      phone: data.phone && data.phone.trim() !== '' ? data.phone : '0550000000', 
      // 👈 هنا الحل: نعطيوه عنوان ومدينة افتراضيين باش يعدي الـ Validation
      address: data.address && data.address.trim() !== '' ? data.address : 'Algeria',
      city: 'Algiers', // 👈 زدنا المدينة
      url: data.url,
      items: data.items,
    };
    const res = await fetch(`${this.baseUrl}/users/invoices`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      this.logger.error('SlickPay invoice creation failed', json);
      throw new BadRequestException(
        json?.message || 'Could not create SlickPay invoice',
      );
    }

    return json.data || json;
  }
}
