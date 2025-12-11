This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment Variables

The following environment variables are required for the application:

### Bill.com Integration

- `BILL_BASE_URL` - Base URL for Bill.com API (e.g., `https://gateway.stage.bill.com/connect/v3`)
- `BILL_DEVELOPER_KEY` - Bill.com developer key for API authentication
- `BILL_USERNAME` - Bill.com account username
- `BILL_PASSWORD` - Bill.com account password
- `BILL_ORGANIZATION_ID` - Bill.com organization ID
- `BILL_ENV` - Environment mode (`mock`, `development`, or `production`)
- `BILL_WEBHOOK_SECRET` - Secret key for verifying Bill.com webhook signatures (required for webhook security)

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)

### Webhook Security

The Bill.com webhook endpoint (`/api/billing/webhook`) requires signature verification to ensure requests are authentic. The webhook signature is verified using HMAC-SHA256 with the `BILL_WEBHOOK_SECRET` environment variable. Bill.com sends the signature in the `X-Bill-Signature` header.

If the `BILL_WEBHOOK_SECRET` is not configured, the webhook endpoint will return a 500 error. If the signature verification fails, the endpoint will return a 401 error.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
