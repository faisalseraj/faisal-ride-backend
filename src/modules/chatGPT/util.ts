export const instructionGuides = {
  about_us: `Very Important Note for you! Focus on the current prompt, don't use previous input that may belongs to other users. Create an engaging 'About Us' section for {business_name}. This description will be featured in a mobile app and should highlight the business's values, mission, and unique aspects, tailored to entice app users. Limit the text to {maxCharacters} max characters and use {language} language. Make sure to not exceed the max Characters in any case. The response you provide will always be copied and pasted in to the fields in the app so avoid ", or the 'About us', or business name etc. the result must be in human langugage format so that the end user will not need to make changes to your response. Avoid quotatoin or commas.`,
  item_name: `Very Important Note for you! Focus on the current prompt, don't use previous input that may belong to other users. Generate a concise, clear, and catchy name for a product to appear on a mobile app's product menu. The name should be instantly recognizable and understandable for customers, fitting well in an app environment. Keep it under {maxCharacters} characters and in {language} language. The response you provide will always be copied and pasted into the fields in the app, so avoid using ", or the keyword 'name' etc. Ensure the name directly reflects the product to avoid any confusion for the end user.`,
  sale_item_name: `Very Important Note for you! Focus on the current prompt, don't use previous input that may belong to other users. Create a striking and clear name for a discounted product to feature in the 'Specials' section of an app-based menu. The name should emphasize the offer's limited availability while being easily understandable to customers. Restrict the name to {maxCharacters} characters and use {language} language. The response you provide will always be copied and pasted into the fields in the app, so avoid using ", or the keyword 'item_name' etc. Make sure the name directly reflects the discounted product or service for easy recognition by the end user.`,
  service_name: `  Very Important Note for you! Focus on the current prompt, don't use previous input that may belong to other users. Generate a concise, clear, and catchy name for a service the business provides to appear on a mobile app's service menu. The name should be instantly recognizable and understandable for customers, fitting well in an app environment. Keep it under {maxCharacters} characters and in {language} language. The response you provide will always be copied and pasted into the fields in the app, so avoid using ", or the keyword 'name' etc. Ensure the name directly reflects the service to avoid any confusion for the end user.`,
  item_description: `Very Important Note for you! Focus on the current prompt, don't use previous input that may belongs to other users. Write a persuasive description for {item_name}, highlighting its key features and benefits. This text will appear on a mobile app’s product menu and should engage and convince app users. Limit the description to {maxCharacters} characters and write in {language} language.  The response you provide will always be copied and pasted in to the fields in the app so avoid ", or the keyword 'item_name' etc. the result must be in human langugage format so that the end user will not need to make changes to your response. Avoid quotatoin or commas.`,
  sale_item_description: `Very Important Note for you! Focus on the current prompt, don't use previous input that may belongs to other users. Compose a compelling description for the on-sale item {item_name}, stressing its benefits and the urgency of the offer. This description will be showcased on a mobile app and should motivate immediate purchases. The text should not exceed {maxCharacters} characters and should be in {language} language.  The response you provide will always be copied and pasted in to the fields in the app so avoid ", or the keyword 'item_name' etc. the result must be in human langugage format so that the end user will not need to make changes to your response. Avoid quotatoin or commas.`,
  service_description: `Very Important Note for you! Focus on the current prompt, don't use previous input that may belongs to other users. Detail the features and advantages of the service {service_name}, for listing on a mobile app. The description should clearly communicate value to app users and fit within {maxCharacters} characters, written in {language} language. The response you provide will always be copied and pasted in to the fields in the app so avoid ", or the keyword 'service_name' etc. the result must be in human langugage format so that the end user will not need to make changes to your response. Avoid quotatoin or commas.`,
  chat_message: `Very Important Note for you! Focus on the current prompt, don't use previous input that may belongs to other users. The response should be in natural, conversational language, without sounding robotic tone and keep the reply concise, within {maxCharacters} characters, in {language} language. Avoid using the customer’s name or any placeholders that require replacement.  User might have asked for different types of service, some of the services are: Availability and Hours: accurately respond based on the provided opening hours and the requested time (e.g., confirming or denying availability).
- Service-Related Questions: pull details from the "categories_of_services" section and respond appropriately.
- Product-Related Questions: pull details from the "categories_of_items_for_sale" section and respond with relevant product information.
- Combined Services or Packages: intelligently check if services can be combined or suggest booking them separately based on the existing categories.
Refer to this Dataset {additional_data}`,
  business_search_tags: `Treat this prompt as a new request from a new user. Generate four focused, one-word search tags for business "{business_name}" considering the user initial prompt to enhance its discoverability in the mobile app. The tags should be relevant, optimized for search functions, and provided in the {language} language. The tags must be separated by a single space only, and there should be no numbering or new lines, as they will populate an input field that treats spaces as separators between tags.
  - Ensure the total number of tags is exactly four.
  - Use only one-word tags.
- Maintain consistency with the given {language}.
# Output Format
Four one-word tags separated by a single space, without any additional formatting.
# Notes
- Confirm the final string's length equals four tags.
- Use the .split(' ') method to verify the tag count. It must not exceed 4.
- Business name can be more than 1 word so if using the busienss name consider them as n number of words.
- Avoid using any numbers or additional punctuation or commas`,
  item_search_tags: `
  Treat this prompt as a new request from a new user. Create four concise, one-word search tags for item name "{item_name}" to help customers locate this product in a mobile app. Ensure the tags reflect key product attributes and are separated by spaces only. The tags should be written in the {language} language.
# Steps
- Identify the key attributes of {item_name} that customers would focus on when searching.
- Translate these attributes into one-word tags in {language}.
- Verify that exactly four tags are created, and that they are separated by spaces with no additional characters or lines.
# Output Format
- The output should be a single line consisting of four one-word tags separated by spaces. Ensure there are no extra spaces or lines.
# Notes
- Confirm the tag words match the language {language} specified.
- Ensure that the final string contains exactly four tags using .split(' ') to validate. It must not exceed 4.
- Item name can be more than 1 word so if using the Item name consider them as n number of words. 
- Avoid using any numbers or additional punctuation or commas `,
  service_search_tags: `Develop four descriptive, one-word search tags for service name "{service_name}" that optimize for mobile app searchability. Tags should concisely capture the essence of the service, be in {language} language, and must not exceed four tags.
# Steps
1. Understand the core functions and features of {service_name}.
2. Identify keywords that best describe the primary aspects of the service.
3. Ensure each keyword is a single, meaningful word that resonates well in {language}.
4. Validate that the total number of tags is exactly four.

# Output Format
The output should be a single line with four comma-separated tags:
keyword1 keyword2 keyword3 keyword4
# Examples
- Service name: **MobileFitnessApp**
  - Tags: fitness tracking health workout
# Notes
- The order and choice of words are crucial for effectively conveying the service’s purpose and maximizing searchability on mobile platforms.
- Avoid using any numbers or additional punctuation or commas `,
  category_name_products: `Very Important Note for you! Focus only on this prompt, avoid using previous inputs from other users. Generate a concise, clear, and catchy name for the product category that directly reflects what the business offers. The name should be easy to understand for customers, suitable for a mobile app, and under {maxCharacters} characters. Use {language} language. The response you provide will always be copied and pasted into the fields in the app, so avoid using ", or the keyword 'category_name_products' etc. Ensure the name is straightforward so that the end user will not need to make changes. Avoid quotation marks or commas.`,

  category_name_services: `Very Important Note for you! Focus only on this prompt, avoid using previous inputs from other users. Generate a concise, clear, and catchy name for the service category that accurately represents the core services of the business. The name should be memorable and easy to understand for customers, suitable for a mobile app, and within {maxCharacters} characters. Use {language} language. The response you provide will always be copied and pasted into the fields in the app, so avoid using ", or the keyword 'category_name_services' etc. Make sure the name directly reflects the service category for ease of understanding. Avoid quotation marks or commas.`,
  category_description_products: `Very Important Note for you! Focus only on this prompt, avoid using previous inputs from other users. Create an appealing description for the product category, highlighting the variety, quality, and unique aspects. This will appear in the mobile app, so make it engaging. Keep the description within {maxCharacters} characters and use {language} language. The response you provide will always be copied and pasted in to the fields in the app so avoid ", or the keyword 'category_description_products' etc. the result must be in human langugage format so that the end user will not need to make changes to your response. Avoid quotatoin or commas.`,

  category_description_services: `Very Important Note for you! Focus only on this prompt, avoid using previous inputs from other users. Write an engaging description for the service category, emphasizing its value and benefits. This text will be shown in the mobile app, so make it appealing. Limit the description to {maxCharacters} characters and use {language} language. The response you provide will always be copied and pasted in to the fields in the app so avoid ", or the keyword 'category_description_services' etc. the result must be in human langugage format so that the end user will not need to make changes to your response. Avoid quotatoin or commas.`,

  other: `Very Important Note for you! Focus on the current prompt, don't use previous input that may belongs to other users. Ensure all content created adheres to specified guidelines, fitting within {maxCharacters} characters and using {language} language for display in a mobile app. `,
};
export const validInstructionGuides = Object.keys(instructionGuides);

export const specialInstructionsForModels = {
  countries_names_translations: ` Translate country names into multiple languages and return them in a structured format. Maintain the original ID and country name in the output.

  - Input: A list of country objects with each having an "_id" and "countryName".
  - Output: A list of objects with each containing the original "_id", "countryName", and "multilangCountryName" with translations in the required languages.
  
  # Steps
  
  1. For each input object:
     - Retrieve the "_id" and "countryName".
     - Translate the "countryName" into the following languages: English, Arabic, French, Spanish, Dutch, German, Hebrew, Italian, Portuguese, and Russian.
  2. Preserve the "countryName" translation in English as it is.
  3. Ensure the translations are accurate for each specified language.
  4. Construct the output object maintaining the original "_id" and "countryName", and append the translations under "multilangCountryName".
  
  # Output Format
  
  The output should be a list of objects formatted as follows:
  json
  [
    {
      "_id": "string",
      "countryName": "string",
      "multilangCountryName": {
        "English": "string",
        "Arabic": "string",
        "French": "string",
        "Spanish": "string",
        "Dutch": "string",
        "German": "string",
        "Hebrew": "string",
        "Italian": "string",
        "Portuguese": "string",
        "Russian": "string"
      }
    },
    ...
  ]
  
  
  # Examples
  
  **Input:**
  json
  [
    {"_id": "1", "countryName": "Germany"},
    {"_id": "2", "countryName": "France"}
  ]
  
  
  **Output:**
  json
  [
    {
      "_id": "1",
      "countryName": "Germany",
      "multilangCountryName": {
        "English": "Germany",
        "Arabic": "ألمانيا",
        "French": "Allemagne",
        "Spanish": "Alemania",
        "Dutch": "Duitsland",
        "German": "Deutschland",
        "Hebrew": "גרמניה",
        "Italian": "Germania",
        "Portuguese": "Alemanha",
        "Russian": "Германия"
      }
    },
    {
      "_id": "2",
      "countryName": "France",
      "multilangCountryName": {
        "English": "France",
        "Arabic": "فرنسا",
        "French": "France",
        "Spanish": "Francia",
        "Dutch": "Frankrijk",
        "German": "Frankreich",
        "Hebrew": "צרפת",
        "Italian": "Francia",
        "Portuguese": "França",
        "Russian": "Франция"
      }
    }
  ]
  
  
  # Notes
  
  - Ensure accuracy in translations as they will be used for multilingual applications.
  - The translations should respect the linguistic nuances and standard naming conventions for countries in each specified language.
  The translation must be valid JSON you must avoid any backticks or mentioning JSON or any other special characters`,

  benchMarkAnalysis: ` ### Example Input:
json
[
  {"fieldName": "email", "currentValue": "john.doe.com", "message": "Invalid email address"},
  {"fieldName": "phoneNumber", "currentValue": "12345", "message": "Invalid phone number"},
  {"fieldName": "age", "currentValue": "-5", "message": "Invalid age"}
]


### Task:
Analyze each field entry, identify validation issues, and suggest corrective actions.

### Example Output:
json
{
  "message": "Please review your submission. The following fields have errors: email, phoneNumber, age.",
  "fields": [
    {
      "name": "email",
      "currentValue": "john.doe.com",
      "message": "Email format is incorrect. Please include an '@' symbol and a valid domain, e.g., 'example@hitsparkingmanager.com'."
    },
    {
      "name": "phoneNumber",
      "currentValue": "12345",
      "message": "PhoneNumber should be a 10-digit number, including the area code, without any letters or symbols. If it's an international number, include the country code."
    },
    {
    "name": "age",
    "currentValue": "-5",
    "message": "Age must be a non-negative numeric value. Please provide a valid age between 0 and 120."
    }
  ]
}


### Explanation:
- **Email**: Specifies the need for a proper email format, addressing the specific error in the provided example.
- **PhoneNumber**: Advises on the correct phone number length and format, and also considers international numbers by mentioning the inclusion of a country code.
- **Age**: Indicates the acceptable range and numeric values for the age, responding directly to the issue with the negative value provided.

This format is JSON compatible, adhering to standards that ensure it won't cause errors when parsed with JSON.parse() in JavaScript environments.
`,

  seoContentGeneration: `Enhance the business content for Google indexing in your Next.js web app. Analyze the business schema and optimize it for improved search engine visibility. We are already using AI for enhancing the content but this enhancement is specialized  for  SEO so your job is to add the most common keywords that user use for searching.

# Steps

1. **Analyze Business Information**: Examine the provided business schema, including details like 'name',
    'establishmentDate',
    'updatedAt',
    'aboutUs',
    'siteId',
    'businessType',
    'address',
    'city',
    'country',
    'latLng',
    'click',
    'isTemporarilyClosed',
    'businessCategory',
    'avgRating',
    'businessStatus',
    'tags',
    'openings',
    'temporarilyClosedDate',.
   
2. **Convert Opening Hours**: Process the openings data to generate a human-readable summary of the business hours for each day. if isTemporarilyClosed = true generate concise message in  this form, "currently closed but will open in {days till the temporarilyClosedDate}" Ensure the summary is concise and clear.

3. **Enhance Content**: Refine the business information to highlight key aspects for better ranking, such as:
   - **Name and Description**: Make sure they are descriptive and keyword-rich.
   - **Location**: Ensure address, city, district, and country details are complete.
   - **Business Status**: Confirm that business status is up to date and clearly stated.
   - **Tags and Category**: Use relevant tags and business category for search optimization. Atleast 20 tags. 
   - **Review Ratings**: Highlight average ratings if available.

4. **Prepare Output**: Format the enhanced data into a valid JSON structure as required for frontend implementation without using backticks or extraneous keywords.

# Output Format

Provide the following details in a JSON object:
- "name": Enhanced business name.
- "aboutUs": Refined business description.
- "location": { "address": ..., "city": ..., "district": ..., "country": ... }
- "businessStatus": Updated status.
- "businessType": Current business type.
- "businessCategory": Current business category.
- "updatedAt": Human-readable update at summary of the business.
- "tags": [Array of tags for the business]
- "operatingHoursSummary": Human-readable summary of when the business opens and closes each day.
- "summary": A short summary of what enhancement you have performed 
Each field should enhance and make the content more appealing for search engines while being clear and informative for users.

# Examples

**Input: Opening Example**
json
{
  "openings": [
    { "day": "Monday", "from": "09:00", "to": "17:00", "isOpen": true },
    { "day": "Tuesday", "from": "09:00", "to": "17:00", "isOpen": true }
  ]
}


**Output: Enhanced JSON**
json
{
  "name": "Tech Solutions",
  "aboutUs": "We provide innovative technology solutions for businesses.",
  "location": { "address": "123 Tech Lane", "city": "Techville", "district": "Tech District", "country": "Technoland" },
  "businessStatus": "Open",
  "tags": ["Technology", "Innovation", "Business Solutions"],
  "operatingHoursSummary": "Opens Monday to Tuesday from 9 AM to 5 PM."
}


**Note**: This is a simplified example; expand with additional details as necessary for real cases.

# Notes

- If isTemporarilyClosed is true, communicate this in the businessStatus.
- Ensure consistent formatting, especially regarding time and date strings.
- Focus on super SEO-friendly descriptions and the inclusion of relevant keywords where appropriate to make the business rank at the top of the google indexing.
- Consider including keywords about your services, special promotions, or unique selling points in the "aboutUs" section. 
- The response must always be a JSON object, double check validation of the a valid JSON before sending. Avoid JSON keyword, or backticks \`, or any other word that could lead to JSON.parse error 
`,
};

export type instructionGuidesKeys = keyof typeof instructionGuides;
