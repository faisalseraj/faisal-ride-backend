// import dashboardIcon from './images/dashboard-icon.svg'

// import config from '../../../config/config';

export const emailTemplate = async ({
  title,
  content,
  link,
  linkTitle,
  link2,
  direction = 'ltr',
  invoiceTemplate = '',
}: {
  title: string;
  content: string;
  link?: string;
  linkTitle?: string;
  link2?: {
    link: string;
    linkTitle: string;
    variant: string;
  };
  direction?: string;
  invoiceTemplate?: string;
}) => {
  invoiceTemplate;
  const FontFamily = direction === 'rtl' ? `'Alexandria',sans-serif !important;` : `'Outfit', sans-serif !important;`;
  return `
  <!DOCTYPE html>
  <html lang="en">
    ${emailHeader(
      FontFamily,
      `<tr>
    <td style="padding:8px; direction: ${direction}" class="details">
      <div style="font-size: 22px;color:black !important; font-weight: 700; direction: ${direction}"><span>${title}</span></div>
      <br />
      <div style="font-size: 14px;color:black !important; font-weight: 500; direction: ${direction}">${Object(
        content
      ).replaceAll('\n', '<span style="height: 8px;display:block;" ><br/></span>')}</div>
    </td>
  </tr>`,
      'emailHeaderLight'
    )}
  ${emailButton(link, linkTitle, link2)}
  ${divider()}
  
  ${templateFooter()}
</table>
<div>

</body
</html>
  `;
};

export const divider = () => {
  return `  <tr>
  <td align="center">
    <table
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="margin: auto; padding-top: 16px; border-radius: 16px; "
      class="tablecontainer4"
    >
      <tr>
        <td>
          <div style="
            border: 3px solid rgb(212, 59, 87);
            border-radius: 4px;
            margin: 32px auto;
          "></div>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
};

export const emailButton = (
  link?: string,
  linkTitle?: string,
  link2?: { link: string; linkTitle: string; variant: string }
) => {
  const link2Element = link2
    ? `
          <a 
            href="${link2.link}"
            target="_blank"
            style="text-decoration: none;" 
          >
          <button 
          style="
            background-color: ${link2.variant === 'success' ? 'rgb(0, 123, 255)' : 'rgb(212, 59, 87)'};
            border: 2px solid ${link2.variant === 'success' ? 'rgb(0, 123, 255)' : 'rgb(212, 59, 87)'};
            border-radius: 8px;
            height: 44px;
            font-size: 14px;
            color: white;
            font-weight: 500;
            text-align: center;
            padding: 8px;
            display: inline-block;
            margin-left: 16px;
          "
          
          >
          ${link2.linkTitle}
          </button>
          </a>
        `
    : '';
  return `
  <tr style="display: ${link && linkTitle ? 'contents' : 'none'}; width:100% ">
  <td align="center">
    <table
      cellpadding="0"
      cellspacing="0"
      border="0"
      width="80%"
      style="margin-top: 28px;"
    >
      <tr>
        <td align="center" >
        
          <a 
            href="${link}"
            target="_blank"

            style="text-decoration: none;" 
          >
          <button 
          style="
            background-color: ${'rgb(212, 59, 87)'};
            border: 2px solid ${'rgb(212, 59, 87)'};
            border-radius: 8px;
            height: 44px;
            font-size: 14px;
            color: white;
            font-weight: 500;
            text-align: center;
            padding: 8px;
            display: inline-block;
          "
          
          >
          ${linkTitle}
          </button>
          </a>

          ${link2Element}
          
        </td>
      </tr>
    </table>
  </td>
</tr>`;
};

export const emailHeader = (
  fontFamily: string,
  details: string,
  logo: string = 'emailHeaderLight',
  invoiceTemplateTr: string = ''
) => {
  const imagesURL: any = {
    logo: `${1}/new-email-header-light.png`,
  };
  return `
  <head>
  <!--[if !mso]><!-->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <!--<![endif]-->
  <!--[if !mso]><!-->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <!--<![endif]-->
    <style link>
    .tablecontainer {
      width: 80% !important;
      margin: auto;
      padding: 16px;
      border-radius: 16px;
      background: rgba(217, 217, 217, 1) !important;
      max-width: 1024px;
    }
    .tablecontainer2 {
      width: 80%;
      margin: auto;
      padding: 16px;
      border-radius: 16px;
    }
    .tablecontainer3 {
      width: 35%;
    }
    .details{
      padding: 16px;
    }
  .tablecontainer4{
    width: 80%;
    max-width: 1024px
  }
    @media only screen and (max-width: 768px) {
      .tablecontainer {
        width: 100% !important;
        margin: auto;
        padding: 4px;
        border-radius: 8px;
        background: rgba(217, 217, 217, 1) !important;
      }
      .tablecontainer2 {
        width: 100%;
        margin: auto;
        padding: 4px;
        border-radius: 8px;
      }
      .tablecontainer3 {
        width: 100%;
        padding: 4px;
      }
      .details{
        padding: 4px !important;
      }
      .tablecontainer4{
        width: 100%;
      }
    
    }
    </style>
  
  </head> 

  <body>
<div style="font-family: ${fontFamily}">
  <table
  cellpadding="0"
  cellspacing="0"
  border="0"
  width="100%"
  style="background-color: white;"
>
  
  <tr>
    <td align="center">
      <table
        cellpadding="0"
        cellspacing="0"
        border="0"
        width="100%"
        style="background-color: rgba(217, 217, 217, 1); margin: auto; padding: 16px; border-radius: 16px;" 
        class="tablecontainer"
      >
      <tr>
    <td style="background-color: rgba(217, 217, 217, 1); border-radius:8px; width: 96vw"  align="center">
    <img width="100%" style="display:none" src="${imagesURL?.[logo]}" class="dark-mode" alt="Email header Dark" />
    </td>

  </tr>
  ${details}
  </table>
  </td>
</tr>


  ${invoiceTemplateTr}`;
};

export const templateFooter = () => {
  // const imagesURL = {
  //   dashboard: `${config.webBackgroundBucket}/email-dashboard-icon.png`,
  //   website: `${config.webBackgroundBucket}/email-website-icon.png`,
  //   technicalSupport: `${config.webBackgroundBucket}/email-technical-support.png`,
  // };

  const links: any = [
    // {
    //   link: config.visitNowLink,
    //   img: `${2}/visit_now.png`,
    //   alt: 'Visit now',
    // },
  ];
  return `
  <tr>
    <td align="center">
      <table
        cellpadding="0"
        cellspacing="0"
        border="0"
        class="tablecontainer3"
      >
        <tr>
          <td>
            <p 
              style="
                font-size: 14px;
                color: black !important;
                font-weight: 600;
                text-align: center;"
            >
              We are here to assist you with any questions or issues. Visit our company website by clicking the button below for quick and efficient support.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
  <td align="center">
    <table
      cellpadding="0"
      cellspacing="0"
      border="0"
      width="100%"
      style="background-color: white; height: 100px;"
    >
      <tr>
        <td align="center">
        ${links
          ?.map((linkDetails: any) => {
            return `<table
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    style="display: inline-block; margin: 0 8px; width: 140px; height: 50px;"
                    >
                    <tr>
                      <td align="center">
                        <a href="${linkDetails?.link}">
                          <img src="${linkDetails.img}" alt="${linkDetails.alt}" width="140" height="60" />
                        </a>
                      </td>
                    </tr>
                    </table>`;
          })
          .join('')}
        </td>
      </tr>
    </table>
  </td>
</tr>`;
};
