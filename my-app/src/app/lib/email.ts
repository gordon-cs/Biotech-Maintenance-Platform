import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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

export async function sendWorkOrderUpdateEmail(
  recipient: EmailRecipient,
  data: WorkOrderUpdateEmailData
) {
  const subject = data.updateType === 'status_change'
    ? `Work Order #${data.workOrderId} Status Updated to ${data.newStatus}`
    : `New Comment on Work Order #${data.workOrderId}`

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
            <p>Hello${recipient.name ? ` ${recipient.name}` : ''},</p>
            
            <p>
              <strong>${data.authorName}</strong> (${data.authorRole}) has posted a 
              <span class="badge ${data.updateType === 'status_change' ? 'badge-status' : 'badge-comment'}">
                ${data.updateType === 'status_change' ? 'Status Update' : 'Comment'}
              </span>
              on work order <strong>#${data.workOrderId}: ${data.workOrderTitle}</strong>
            </p>
            
            ${data.updateType === 'status_change' && data.newStatus ? `
              <p>
                <strong>New Status:</strong> 
                <span style="text-transform: capitalize; font-weight: 600; color: #059669;">
                  ${data.newStatus}
                </span>
              </p>
            ` : ''}
            
            <div class="update-body">
              <strong>${data.updateType === 'status_change' ? 'Reason:' : 'Message:'}</strong>
              <p style="margin: 10px 0 0 0; white-space: pre-wrap;">${data.updateBody}</p>
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
