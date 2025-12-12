// import dashboardIcon from './images/dashboard-icon.svg'

import { divider, emailHeader, templateFooter } from "./email-template";

export const emailTemplateV2 = async ({
  title,
  content,
  link1,
  link2,
  linkTitle1,
  link1Color,
  link2Color,
  linkTitle2,
  direction = 'ltr',

}: {
  title: string;
  content: string;
  link1?: string;
  link1Color?: string;
  linkTitle1?: string;

  link2Color?: string;
  link2?: string;
  linkTitle2?: string;
  direction?: string;

}) => {

  const FontFamily = direction === 'rtl' ? `'Alexandria',sans-serif !important;` : `'Outfit', sans-serif !important;`

  return `
  <!DOCTYPE html>
  <html lang="en">
    ${emailHeader(FontFamily, `<tr>
    <td style="padding: 16px; direction: ${direction}">
      <div style="font-size: 22px;color:black; font-weight: 700; direction: ${direction}"><span>${title}</span></div>
      <div style="font-size: 14px;color:black; font-weight: 500; direction: ${direction}">${Object(content).replaceAll('\n', '<br />')}</div>
    </td>
  </tr>`)}
  ${emailButtons(link1, linkTitle1, link2, linkTitle2, link1Color, link2Color)}
  ${divider()}
  
  ${templateFooter()}
</table>
<div>

</body
</html>
 `;
};


export const emailButtons = (link1?:string, linkTitle1?:string, link2?:string, linkTitle2?:string, link1Color?:string, link2Color?:string) => {
  return `
  <tr style="display: ${link1 && linkTitle1 && link2 && linkTitle2 ? 'contents' : 'none'}; width:100% ">
  <td align="center">
    <table cellpadding="0" cellspacing="0" border="0" width="80%" style="margin-top: 28px;">
      <tr>
        <td align="center">
          <a href='${link1}' style="text-decoration: none; margin-right: 8px;">
            <table style="display: inline-table;">
              <tr>
                <td>
                  <button style="
                    background-color: ${link1Color ?? 'green'};
                    border: 2px solid ${link1Color ?? 'green'};
                    border-radius: 8px;
                    height: 44px;
                    font-size: 14px;
                    color: white;
                    font-weight: 500;
                    text-align: center;
                    padding: 8px
                  ">
                    ${linkTitle1}
                  </button>
                </td>
              </tr>
            </table>
          </a>
          <a href='${link2}' style="text-decoration: none;">
            <table style="display: inline-table;">
              <tr>
                <td>
                  <button style="
                    background-color: ${link2Color ?? 'red'};
                    border: 2px solid ${link2Color ?? 'red'};
                    border-radius: 8px;
                    height: 44px;
                    font-size: 14px;
                    color: white;
                    font-weight: 500;
                    text-align: center;
                    padding: 8px
                  ">
                    ${linkTitle2}
                  </button>
                </td>
              </tr>
            </table>
          </a>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}