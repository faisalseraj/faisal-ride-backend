// import dashboardIcon from './images/dashboard-icon.svg'

import {  } from "./email-templateV2";

import { divider, emailHeader, templateFooter } from "./email-template";

export const emailTemplateV3 = async ({
  title,
  content,
  link,
  linkTitle,
  direction = 'ltr',
  linkToUnsub
}: {
  title: string;
  content: string;
  link?: string;
  linkTitle?: string;
  direction?: string;
  linkToUnsub?:string
}) => {
  link 
  linkTitle

  const FontFamily = direction === 'rtl' ? `'Alexandria',sans-serif !important;` : `'Outfit', sans-serif !important;`
  return `
  <!DOCTYPE html>
  <html lang="en">
    ${emailHeader(FontFamily, `<tr>
    <td style="padding:8px; direction: ${direction}" class="details">
      <div style="font-size: 22px;color:black !important; font-weight: 700; direction: ${direction}"><span>${title}</span></div>
      <br />
      <div style="font-size: 14px;color:black !important; font-weight: 500; direction: ${direction}">${Object(content).replaceAll('\n', '<span style="height: 8px;display:block;" ><br/></span>')}</div>
    </td>
  </tr>`, 'emailHeaderWhite')}
  ${emailButton( linkToUnsub, "Unsubscribe Me", ' #FD4146')}
  ${divider()}
  
  ${templateFooter()}
</table>
<div>

</body
</html>
  `;
};

export const emailButton = (link?:string, linkTitle?:string, color?:string) => {
  return `
  <tr style="display: ${link && linkTitle ? 'contents' : 'none'}; width:100% ">
  <td align="center">
    <table
      cellpadding="0"
      cellspacing="0"
      border="0"
      width="80%"
      style="margin-top: 28px; "
    >
      <tr>
        <td align="center" >
        
          <a 
            href='${link}'
            style="
              text-decoration: none;" 
          >
          <button 
          style="
              background-color: ${color  || '#FD4146'};
              border: 2px solid ${color  || '#FD4146'};
              border-radius: 8px;
              height: 44px;
              font-size: 14px;
              color: white;
              font-weight: 500;
              text-align: center;
              padding: 8px
          "
          
          >
          ${linkTitle}
          </button>
          </a>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}
