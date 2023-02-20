const dayjs = require("dayjs");
const Parser = require("rss-parser");
const parser = new Parser();

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({
  region: "us-east-1",
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

async function run(identifier, url) {
  let feed;
  try {
    feed = await parser.parseURL(url);
  } catch (err) {
    console.error("Failed parsing feed", err);
    throw err;
  }

  const latestArticle = feed.items[0];

  let { creator, isoDate, link, title } = latestArticle;
  const articleMeta = { creator, isoDate, link, title };

  const currentTime = dayjs();
  try {
    await docClient.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          pk: `${identifier}-${currentTime.format("YYYY-MM")}`,
          sk: currentTime.unix().toString(),
          ...articleMeta,
        },
      })
    );
  } catch (err) {
    console.error("Failed putting entry into dynamo", err);
    throw err;
  }
}

exports.handler = async function (event) {
  try {
    await run(event.identifier, event.url);
    return {
      statusCode: 200,
      body: "RSS Datapoint saved",
    };
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }
};
