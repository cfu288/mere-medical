import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-md px-4 py-4 sm:max-w-3xl sm:px-6 lg:px-0">
      <div dangerouslySetInnerHTML={{ __html: policy }} />
      <p>
        You are advised to review this Privacy Policy periodically for any
        changes. Changes to this Privacy Policy are effective when they are
        posted on this page.
      </p>
      <h1>Contact Us</h1>
      <p>
        If you have any questions about this Privacy Policy, You can contact us:
      </p>
      <ul>
        <li>By email: cfu288@meremedical.co</li>
      </ul>
    </div>
  );
}

const policy = `
<style>
  body {
    margin: 0px;
    font-family: system-ui, Roboto, Helvetica, sans-serif;
    line-height: 1.5rem;
  }
  h2 {
    color: #3dace3;
    font-weight: 400;
    background-color: #ebebeb;
    padding: 1.5rem;
    margin-bottom: 0px;
  }
  a {
    color: #3dace3;
  }

  /* Table styles */
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th, td {
    padding: 1.5rem;
    vertical-align: top;
    border: 1px solid #eee
  }
  th {
    background-color: #f7f7f7;
  }
  th:last-child, td:last-child {
    width: 40%;
  }

  /* Tooltip container */
  .tooltip {
    position: relative;
    display: inline-block;
    border-bottom: 3px solid #ccc;
  }

  /* Tooltip text */
  .tooltip .tooltiptext {
    visibility: hidden;
    width: 200px;
    font-weight: 400;
    font-size: 12px;
    line-height: 15px;
    background-color: #555;
    color: #fff;
    text-align: left;
    padding: 5px 7px;
    border-radius: 3px;

    /* Position the tooltip text */
    position: absolute;
    z-index: 1;
    bottom: 125%;
    left: 50%;
    margin-left: -60px;

    /* Fade in tooltip */
    opacity: 0;
    transition: opacity 1s;
  }

  /* Tooltip arrow */
  .tooltip .tooltiptext::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #555 transparent transparent transparent;
  }

  /* Show the tooltip text when you mouse over the tooltip container */
  .tooltip:hover .tooltiptext {
    visibility: visible;
    opacity: 1;
  }  

  .half {
    display: inline-block;
    width:49%;
  }

  @media only screen and (max-width: 600px) {
    .half {
      display: inline-block;
      width: 100%;
    }
  }

</style>
<h1 id="meremedicalmodelprivacynotice">Mere Medical Model Privacy Notice</h1>
<p><strong>Note:</strong> Developers of consumer health technology or apps (“health technology developers”) that collect 
digital health data about individuals would use this template to disclose to consumers the developer’s 
privacy and security policies. <strong>"We"</strong> refers to the health technology developer or technology product and 
<strong>"you/your"</strong> refers to the user/consumer of the health technology. 
</div> </p>
<p>Last updated: March 13, 2023</p>
<h2 id="usehowweuseyourdatainternally">Use: How we use your data internally</h2>
<h3>
  We collect and use your 
  <div class="tooltip">
    identifiable data
    <div class="tooltiptext">
      Identifiable data means: data, such as your name, phone number, email, address, health services, information on your physical or mental health conditions, or your social security number, that can be used on its own or with other information to identify you.     
    </div>
  </div>:
</h3>
<ul><li>To provide the 
<span class="tooltip">
  primary service
  <div class="tooltiptext">
    Primary service means: Mere Medical stores health data from multiple sources directly on your device
  </div>
</span>
of the app or technology</li></ul>
<p><br></br>  </p>
<h2 id="sharehowweshareyourdataexternallywithothercompaniesorentities">Share: How we share your data externally with other companies or entities</h2>
<h3>
  We share your 
  <div class="tooltip">
    identifiable data
    <div class="tooltiptext">
      Identifiable data means: data, such as your name, phone number, email, address, health services, information on your physical or mental health conditions, or your social security number, that can be used on its own or with other information to identify you.     
    </div>
  </div>:
</h3>
<ul><li>We DO NOT share your 
<span class="tooltip">
  identifiable data
  <div class="tooltiptext">
  Identifiable data means: data, such as your name, phone number, email, address, health services, information on your physical or mental health conditions, or your social security number, that can be used on its own or with other information to identify you.
  </div>
</span>
</li></ul>
<p><br></br>  </p>
<h3 id="weshareyourdataafterremovingidentifiersnotethatremainingdatamaynotbeanonymous">We share your data AFTER removing identifiers (note that remaining data may not be anonymous):</h3>
<ul>
<li>We DO NOT share your data after removing identifiers<br />
<br></br>  </li>
</ul>
<h2 id="sellwhowesellyourdatato">Sell: Who we sell your data to</h2>
<table>
  <tr>
    <th><strong>Sold Data<strong></th>
    <th style='width:40%;'><strong>Do we sell?<strong></th>
  </tr>
  <tr>
    <td>
      <strong>
        We sell your 
        <span class="tooltip">
          identifiable data
          <div class="tooltiptext">
          Identifiable data means: data, such as your name, phone number, email, address, health services, information on your physical or mental health conditions, or your social security number, that can be used on its own or with other information to identify you.
          </div>
        </span>
        to 
        <span class="tooltip">
          data brokers
          <div class="tooltiptext">
          Data broker means: companies that collect personal information about consumers from a variety of public and non-public sources and resell the information to other companies
          </div>
        </span>
        , marketing, advertising networks, or analytics firms.
      </strong>
    </td>
    <td> No </td>
  </tr>
  <tr>
    <td><strong>We sell your data AFTER removing identifiers (note that remaining data may not be anonymous) to 
    <span class="tooltip">
      data brokers
      <div class="tooltiptext">
      Data broker means: companies that collect personal information about consumers from a variety of public and non-public sources and resell the information to other companies
      </div>
    </span>
    , marketing, advertising networks, or analytics firms.</strong></td>
    <td> No </td>
  </tr>
</table>
<p><br></br></p>
<h2 id="storehowwestoreyourdata">Store: How we store your data</h2>
<table>
  <tr>
    <th><strong>Stored Data<strong></th>
    <th><strong>Is it stored?<strong></th>
  </tr>
  <tr>
    <td><strong>Are your data stored on the device? </strong></td>
    <td>Yes </td>
  </tr>
  <tr>
    <td><strong>Are your data stored outside the device at our company or through a third party?</strong></td>
    <td> No</td>
  </tr>
</table>
<p><br />
<br></br></p>
<h2 id="encryptionhowweencryptyourdata">Encryption: How we encrypt your data</h2>
<table>
  <tr>
    <th><strong>Encrypted Data<strong></th>
    <th><strong>Is it encrypted?<strong></th>
  </tr>
  <tr>
    <td><strong>Does the app or technology use 
    <div class="tooltip">
      encryption
      <div class="tooltiptext">
        Encryption means: a method of converting an original message of regular text into encoded text in such a way that only authorized parties can read it.     
      </div>
    </div>    
    to encrypt your data in the device or app? </strong></td>
    <td> No  </td>
  </tr>
  <tr>
    <td><strong>Does the app or technology use 
    <div class="tooltip">
      encryption
      <div class="tooltiptext">
        Encryption means: a method of converting an original message of regular text into encoded text in such a way that only authorized parties can read it.     
      </div>
    </div>    
    to encrypt your data when stored on our company servers or with an outside 
    <div class="tooltip">
      cloud computing
      <div class="tooltiptext">
        Cloud computing means: a kind of Internet-based computing that provides shared processing resources and data to computers and other devices on demand.     
      </div>
    </div>    
    services provider?</strong></td>
    <td>  N/A </td>
  </tr>
  <tr>
    <td><strong>Does the app or technology use
    <div class="tooltip">
      encryption
      <div class="tooltiptext">
        Encryption means: a method of converting an original message of regular text into encoded text in such a way that only authorized parties can read it.     
      </div>
    </div>    
    to encrypt your data while it is transmitted?</strong></td>
    <td>   Yes, when you take certain steps (<a target='_blank' href='https://meremedical.co/docs/getting-started/docker#setting-up-with-docker-compose--local-ssl-with-mkcert--nginx'>click to learn how</a>)</td>
  </tr>
</table>
<p>
<br></br>  </p>
<h2 id="privacyhowthistechnologyaccessesotherdata">Privacy: How this technology accesses other data</h2>
<table style='vertical-align: top'>
  <tr>
    <th><strong>Other Data<strong></th>
    <th style='width:40%;'><strong>Is it accessed?<strong></th>
  </tr>
  <tr>
    <td><strong>Will this technology or app request access to other device data or applications, such as your phone’s camera, photos, or contacts? </strong></td>    
<td>No</td>
  </tr>
  <tr>
    <td><strong>Does this technology or app allow you to share the collected data with your social media accounts, like Facebook?</strong></td>
    <td> No</td>
  </tr>
</table>
<p><br></br></p>
<h2 id="useroptionswhatyoucandowiththedatathatwecollect">User Options: What you can do with the data that we collect</h2>
<table>
  <tr>
    <td><strong>Can you access, edit, share, or delete the data we have about you?</strong></td>
    <td>Yes, you can ... <br> <li>access your data</li> <li>edit your data</li> <li>share your data</li> <li>delete your data</li> Step 1) Go to Settings
Step 2) Click "Start data export" under "Export data" 
    </td>
  </tr>
</table>
<p>
<br></br></p>
<h2>
  <div class="tooltip">
    Deactivation
    <div class="tooltiptext">
      Deactivation means: an individual takes action or a company ceases operation or deactivates an individual’s account due to inactivity.     
    </div>
  </div>: What happens to your data when your account is deactivated 
</h2>
<table>
  <tr>
    <td><strong>When your account is deactivated/terminated by you or the company, your data are...  </strong></td>
    <td>   Deleted immediately </td>
  </tr>
</table>
<p><br></br></p>
<h2 id="policychangeshowwewillnotifyyouifourprivacypolicychanges">Policy Changes: How we will notify you if our privacy policy changes</h2>
<p>Via update to our privacy policy</p>
<div>Find out more in the <a href='https://meremedical.co/privacy-policy' target='_blank'>Changes section of our Privacy Policy</a> (https://meremedical.co/privacy-policy)<br></div>
<p><br></br></p>
<h2>
  <div class="tooltip">
    Breach
    <div class="tooltiptext">
      Breach means: an unauthorized disclosure.     
    </div>
  </div>: How we will notify you and protect your data in case of an improper disclosure
</h2>
<p>Mere Medical complies with all applicable laws regarding breaches.<br />
Via blog post and update to our privacy policy</p>
<div>Find out more in the <a href='https://meremedical.co/privacy-policy' target='_blank'>Breach section of our Privacy Policy</a> (https://meremedical.co/privacy-policy)<br></div>
<p><br></br></p>
<h2 id="contactus">Contact Us</h2>
<h3 id="meremedical">Mere Medical</h3>
<div><a href='https://meremedical.co/privacy-policy' target='_blank'>Privacy Policy</a> (https://meremedical.co/privacy-policy)<br></div>
<div><a href='https://meremedical.co' target='_blank'>Contact Page</a> (https://meremedical.co)<br></div>
<p><a href="mailto:cfu288@meremedical.co">cfu288@meremedical.co</a><br />
`;
