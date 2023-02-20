const dayjs = require("dayjs");

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({
  region: "us-east-1",
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

exports.handler = async function () {
  const resp = await docClient.send(
    new QueryCommand({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": "css-tricks-2023-02",
      },
    })
  );

  let lastRecord = resp.Items.pop();
  const today = dayjs();
  let daysSince = today.diff(dayjs(lastRecord.isoDate), "days");
  return {
    statusCode: 200,
    body: JSON.stringify({ daysSince: daysSince + " days" }),
  };
};
