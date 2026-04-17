import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Helper function to escape HTML entities to prevent XSS
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

type EmailRecipient = {
  email: string
  name?: string
}

type WorkOrderUpdateEmailData = {
  workOrderId: number
  workOrderTitle: string
  updateType: 'comment' | 'status_change'
  newStatus?: string
  updateBody: string
  authorName: string
  authorRole: string
}

type InvoiceEmailData = {
  invoiceType: 'initial_fee' | 'service'
  invoiceNumber: string
  workOrderId: number
  workOrderTitle: string
  amount: number
  dueDate: string
}

export async function sendInvoiceNotificationEmail(
  recipient: EmailRecipient,
  data: InvoiceEmailData
) {
  const subject = data.invoiceType === 'initial_fee'
    ? `Invoice ${data.invoiceNumber} - Platform Initial Fee`
    : `Invoice ${data.invoiceNumber} - Service Fee for Work Order #${data.workOrderId}`

  const invoiceTypeLabel = data.invoiceType === 'initial_fee' 
    ? '🏢 Platform Initial Fee'
    : '🔧 Service Fee'

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); color: white; padding: 30px 20px; border-radius: 5px 5px 0 0; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 5px 5px; }
          .invoice-box { background-color: white; border: 2px solid #0d9488; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .invoice-header { border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 15px; }
          .invoice-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .invoice-row.total { font-weight: bold; font-size: 18px; color: #0f766e; border-bottom: none; }
          .invoice-label { color: #6b7280; }
          .invoice-value { text-align: right; font-weight: 600; }
          .action-section { margin-top: 30px; text-align: center; }
          .button { display: inline-block; padding: 14px 32px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; }
          .button:hover { background-color: #0f766e; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
          .info-box { background-color: #f0fdfa; border-left: 4px solid #0d9488; padding: 15px; margin: 15px 0; border-radius: 4px; }
          .label-badge { display: inline-block; padding: 6px 12px; background-color: #0d9488; color: white; border-radius: 4px; font-size: 12px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0; font-size: 28px;">Invoice Ready for Payment</h2>
            <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.95;">Boston Biotech Management Platform</p>
          </div>
          <div class="content">
            <p>Hello ${escapeHtml(recipient.name || 'there')},</p>
            
            <p>A new invoice has been generated and is ready for payment. Please review the details below:</p>
            
            <div class="invoice-box">
              <div class="invoice-header">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <h3 style="margin: 0 0 5px 0; color: #0f766e;">Invoice #${escapeHtml(data.invoiceNumber)}</h3>
                    <span class="label-badge">${invoiceTypeLabel}</span>
                  </div>
                  <div style="text-align: right;">
                    <div style="color: #6b7280; font-size: 12px;">Due Date</div>
                    <div style="font-weight: bold; color: #1f2937;">${new Date(data.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                </div>
              </div>
              
              <div class="invoice-row">
                <span class="invoice-label">Work Order</span>
                <span class="invoice-value">#${data.workOrderId}: ${escapeHtml(data.workOrderTitle)}</span>
              </div>
              
              <div class="invoice-row">
                <span class="invoice-label">Description</span>
                <span class="invoice-value">${data.invoiceType === 'initial_fee' ? 'Platform Service Fee' : 'Service Fee'}</span>
              </div>
              
              <div class="invoice-row total">
                <span>Amount Due</span>
                <span style="color: #059669;">$${Number(data.amount).toFixed(2)}</span>
              </div>
            </div>
            
            <div class="info-box">
              <strong>📋 Next Steps:</strong>
              <p style="margin: 10px 0 0 0; font-size: 14px;">
                Click the button below to view and pay this invoice via our secure payment portal.
              </p>
            </div>
            
            <div class="action-section">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/manager/payment_requests" class="button">
                View Invoice & Pay
              </a>
            </div>
            
            <p style="margin-top: 20px; font-size: 14px; color: #6b7280; text-align: center;">
              If you have any questions about this invoice, please contact your facility manager.
            </p>
            
            <div class="footer">
              <p style="margin: 0 0 10px 0;">This is an automated notification from the Boston Biotech Management Platform.</p>
              <p style="margin: 0;">Please do not reply to this email. For assistance, contact support.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `

  const emailText = `
Invoice Ready for Payment

Hello ${recipient.name || 'there'},

A new invoice has been generated and is ready for payment.

---

Invoice #${data.invoiceNumber}
${invoiceTypeLabel}
Due Date: ${new Date(data.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Work Order: #${data.workOrderId}: ${data.workOrderTitle}
Description: ${data.invoiceType === 'initial_fee' ? 'Platform Service Fee' : 'Service Fee'}

Amount Due: $${Number(data.amount).toFixed(2)}

---

Next Steps:
Visit the payment portal to view and pay this invoice: 
${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/manager/payment_requests

---

This is an automated notification from the Boston Biotech Management Platform.
Please do not reply to this email.
If you have questions, contact your facility manager.
  `.trim()

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: recipient.email,
      subject,
      html: emailHtml,
      text: emailText,
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('[Email] Failed to send invoice notification:', error)
    return { success: false, error }
  }
}

export async function sendWorkOrderUpdateEmail(
  recipient: EmailRecipient,
  data: WorkOrderUpdateEmailData
) {
  const subject = data.updateType === 'status_change'
    ? `Work Order #${data.workOrderId} Status Updated to ${data.newStatus}`
    : `New Comment on Work Order #${data.workOrderId}`

  // Escape all user-provided data for HTML to prevent XSS
  const escapedRecipientName = recipient.name ? escapeHtml(recipient.name) : ''
  const escapedAuthorName = escapeHtml(data.authorName)
  const escapedAuthorRole = escapeHtml(data.authorRole)
  const escapedWorkOrderTitle = escapeHtml(data.workOrderTitle)
  const escapedUpdateBody = escapeHtml(data.updateBody)
  const escapedNewStatus = data.newStatus ? escapeHtml(data.newStatus) : undefined

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #16a34a; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 5px 5px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 600; }
          .badge-status { background-color: #dbeafe; color: #1e40af; }
          .badge-comment { background-color: #f3f4f6; color: #374151; }
          .update-body { background-color: white; padding: 15px; border-left: 4px solid #16a34a; margin: 15px 0; border-radius: 4px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
          .button { display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">Work Order Update</h2>
          </div>
          <div class="content">
            <p>Hello${escapedRecipientName ? ` ${escapedRecipientName}` : ''},</p>
            
            <p>
              <strong>${escapedAuthorName}</strong> (${escapedAuthorRole}) has posted a 
              <span class="badge ${data.updateType === 'status_change' ? 'badge-status' : 'badge-comment'}">
                ${data.updateType === 'status_change' ? 'Status Update' : 'Comment'}
              </span>
              on work order <strong>#${data.workOrderId}: ${escapedWorkOrderTitle}</strong>
            </p>
            
            ${data.updateType === 'status_change' && escapedNewStatus ? `
              <p>
                <strong>New Status:</strong> 
                <span style="text-transform: capitalize; font-weight: 600; color: #059669;">
                  ${escapedNewStatus}
                </span>
              </p>
            ` : ''}
            
            <div class="update-body">
              <strong>${data.updateType === 'status_change' ? 'Reason:' : 'Message:'}</strong>
              <p style="margin: 10px 0 0 0; white-space: pre-wrap;">${escapedUpdateBody}</p>
            </div>
            
            <p>You can view the full work order details and respond by clicking the button below:</p>
            
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/work-orders/past?selected=${data.workOrderId}" class="button">
              View Work Order
            </a>
            
            <div class="footer">
              <p>This is an automated notification from Boston Biotech Management.</p>
              <p>Please do not reply to this email. If you need assistance, please contact your facility manager.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `

  const emailText = `
Work Order Update

Hello${recipient.name ? ` ${recipient.name}` : ''},

${data.authorName} (${data.authorRole}) has posted a ${data.updateType === 'status_change' ? 'status update' : 'comment'} on work order #${data.workOrderId}: ${data.workOrderTitle}

${data.updateType === 'status_change' && data.newStatus ? `New Status: ${data.newStatus}\n` : ''}
${data.updateType === 'status_change' ? 'Reason:' : 'Message:'}
${data.updateBody}

View the full work order at: ${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/work-orders/past?selected=${data.workOrderId}

---
This is an automated notification from Boston Biotech Management.
Please do not reply to this email. If you need assistance, please contact your facility manager.
  `.trim()

  try {
    const result = await resend.emails.send({
      from: 'Boston Biotech Management <no-reply@bostonbiotechmanagement.com>',
      to: recipient.email,
      subject,
      html: emailHtml,
      text: emailText,
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to send email:', error)
    return { success: false, error }
  }
}

type TechnicianVerificationEmailData = {
  technicianName: string
  technicianEmail: string
  technicianId: string
  experience: string
  bio: string
  company?: string
}

export async function sendTechnicianVerificationEmail(
  data: TechnicianVerificationEmailData
) {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    console.error('ADMIN_EMAIL environment variable is not configured')
    throw new Error('ADMIN_EMAIL environment variable is required to send technician verification emails')
  }
  const subject = `New Technician Registration - ${data.technicianName}`

  // Escape all user-provided data for HTML to prevent XSS
  const escapedName = escapeHtml(data.technicianName)
  const escapedEmail = escapeHtml(data.technicianEmail)
  const escapedExperience = escapeHtml(data.experience)
  const escapedBio = escapeHtml(data.bio)
  const escapedCompany = data.company ? escapeHtml(data.company) : undefined
  const escapedTechId = escapeHtml(data.technicianId)

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 5px 5px; }
          .info-section { background-color: white; padding: 15px; margin: 15px 0; border-radius: 4px; border-left: 4px solid #2563eb; }
          .info-label { font-weight: 600; color: #374151; margin-bottom: 5px; }
          .info-value { color: #1f2937; white-space: pre-wrap; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
          .button { display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          .alert { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">New Technician Registration</h2>
          </div>
          <div class="content">
            <div class="alert">
              <strong>⚠️ Action Required:</strong> A new technician has registered and needs verification before they can accept work orders.
            </div>
            
            <div class="info-section">
              <div class="info-label">Technician Name:</div>
              <div class="info-value">${escapedName}</div>
            </div>
            
            <div class="info-section">
              <div class="info-label">Email:</div>
              <div class="info-value">${escapedEmail}</div>
            </div>
            
            ${escapedCompany ? `
              <div class="info-section">
                <div class="info-label">Company:</div>
                <div class="info-value">${escapedCompany}</div>
              </div>
            ` : ''}
            
            <div class="info-section">
              <div class="info-label">Experience:</div>
              <div class="info-value">${escapedExperience}</div>
            </div>
            
            <div class="info-section">
              <div class="info-label">Bio:</div>
              <div class="info-value">${escapedBio}</div>
            </div>
            
            <p style="margin-top: 20px;">
              Please review this technician's information and verify them in the admin panel to allow them to start accepting work orders.
            </p>
            
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin/users" class="button">
              Go to Admin Panel
            </a>
            
            <div class="footer">
              <p>This is an automated notification from the Biotech Maintenance Platform.</p>
              <p><strong>Technician ID:</strong> ${escapedTechId}</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `

  const emailText = `
New Technician Registration

⚠️ ACTION REQUIRED: A new technician has registered and needs verification.

Technician Name: ${data.technicianName}
Email: ${data.technicianEmail}
${data.company ? `Company: ${data.company}\n` : ''}
Experience:
${data.experience}

Bio:
${data.bio}

Please review this technician's information and verify them in the admin panel to allow them to start accepting work orders.

Go to Admin Panel: ${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin/users

Technician ID: ${data.technicianId}

---
This is an automated notification from the Biotech Maintenance Platform.
  `.trim()

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: adminEmail,
      subject,
      html: emailHtml,
      text: emailText,
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to send technician verification email:', error)
    return { success: false, error }
  }
}

type VendorConnectionInviteEmailData = {
  recipientEmail: string
  recipientName?: string | null
  vendorName: string
  vendorId: string
}

export async function sendVendorConnectionInviteEmail(
  data: VendorConnectionInviteEmailData
) {
  const escapedRecipientName = data.recipientName ? escapeHtml(data.recipientName) : ''
  const escapedVendorName = escapeHtml(data.vendorName)
  const escapedVendorId = escapeHtml(data.vendorId)

  const subject = 'Action Required: Connect your Bill.com profile for ACH payments'

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0f766e; color: white; padding: 20px; border-radius: 6px 6px 0 0; }
          .content { background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 6px 6px; }
          .steps { background: #fff; border-left: 4px solid #0f766e; padding: 14px; margin: 16px 0; }
          .button { display: inline-block; padding: 12px 22px; background: #0f766e; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; }
          .footer { margin-top: 18px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin:0;">Complete Vendor Connection for ACH Payments</h2>
          </div>
          <div class="content">
            <p>Hello${escapedRecipientName ? ` ${escapedRecipientName}` : ''},</p>
            <p>
              Your vendor profile (<strong>${escapedVendorName}</strong>) is synced, but your Bill.com payment network status is not connected yet.
            </p>

            <div class="steps">
              <strong>What to do next:</strong>
              <ol>
                <li>Open Bill.com and find your vendor invitation.</li>
                <li>Click <em>Invite to connect in Bill.com</em> (if prompted).</li>
                <li>Create/login to Bill.com and add your bank details.</li>
                <li>Accept the payment network connection.</li>
              </ol>
            </div>

            <p>
              After this is completed, your network status should show as <strong>Connected</strong> and ACH payouts can proceed.
            </p>

            <p>
              <a class="button" href="https://app.bill.com">Open Bill.com</a>
            </p>

            <div class="footer">
              <p>Vendor ID: ${escapedVendorId}</p>
              <p>This is an automated message from the Biotech Maintenance Platform.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `

  const emailText = `
Complete Vendor Connection for ACH Payments

Hello${data.recipientName ? ` ${data.recipientName}` : ''},

Your vendor profile (${data.vendorName}) is synced, but your Bill.com payment network status is not connected yet.

What to do next:
1) Open Bill.com and find your vendor invitation.
2) Click "Invite to connect in Bill.com" (if prompted).
3) Create/login to Bill.com and add your bank details.
4) Accept the payment network connection.

After this is completed, your network status should show as Connected and ACH payouts can proceed.

Open Bill.com: https://app.bill.com
Vendor ID: ${data.vendorId}

This is an automated message from the Biotech Maintenance Platform.
  `.trim()

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: data.recipientEmail,
      subject,
      html: emailHtml,
      text: emailText,
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to send vendor connection invite email:', error)
    return { success: false, error }
  }
}
