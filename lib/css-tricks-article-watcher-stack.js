const {
  Stack,
  Duration,
  RemovalPolicy,
  aws_iam,
  Size,
} = require("aws-cdk-lib");
const { Runtime } = require("aws-cdk-lib/aws-lambda");
// const sqs = require('aws-cdk-lib/aws-sqs');
const lambda = require("aws-cdk-lib/aws-lambda");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const { AttributeType } = require("aws-cdk-lib/aws-dynamodb");
const eventBridgeScheduler = require("aws-cdk-lib/aws-scheduler");
const {
  ServicePrincipal,
  Policy,
  PolicyStatement,
  Effect,
} = require("aws-cdk-lib/aws-iam");
const path = require("path");

class CssTricksArticleWatcherStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const rssDataTable = new dynamodb.Table(this, "RSSDataTable", {
      removalPolicy: RemovalPolicy.RETAIN,
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
    });

    const analyzeRSSFn = new lambda.Function(this, "AnalyzeRSSFn", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "..", "lambdas", "analyze-rss")
      ),
      description:
        "Fetch the CSS Tricks RSS Feed on a schedule to analyze when the last article was posted",
      handler: "index.handler",
      runtime: Runtime.NODEJS_18_X,
      timeout: Duration.seconds(10),
      environment: {
        TABLE_NAME: rssDataTable.tableName,
      },
      memorySize: 512,
    });

    const lastTimeFn = new lambda.Function(this, "LastTimeFn", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "..", "lambdas", "last-time")
      ),
      description:
        "Calculate how many days it has been since an article was posted on CSS Tricks",
      handler: "index.handler",
      runtime: Runtime.NODEJS_18_X,
      timeout: Duration.seconds(10),
      environment: {
        TABLE_NAME: rssDataTable.tableName,
      },
      memorySize: 512,
    });

    rssDataTable.grantReadWriteData(lastTimeFn);
    rssDataTable.grantReadWriteData(analyzeRSSFn);

    const scheduleRole = new aws_iam.Role(this, "RSSScheduleRole", {
      assumedBy: new ServicePrincipal("scheduler.amazonaws.com"),
    });

    new Policy(this, "invokeAnalyzeRssLambdaPolicy", {
      roles: [scheduleRole],
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["lambda:invokeFunction"],
          resources: [analyzeRSSFn.functionArn],
        }),
      ],
    });

    rssDataTable.grantReadWriteData(scheduleRole);

    new eventBridgeScheduler.CfnSchedule(this, "AnalyzeRSSSchedule", {
      scheduleExpression: "rate(12 hours)",
      scheduleExpressionTimezone: "America/New_York",
      flexibleTimeWindow: {
        mode: "OFF",
      },
      description:
        "Schedule for triggering the Analyze CSS Tricks RSS Feed Lambda Function",
      target: {
        arn: analyzeRSSFn.functionArn,
        roleArn: scheduleRole.roleArn,
        input: JSON.stringify({
          identifier: "css-tricks",
          url: "https://css-tricks.com/feed/",
        }),
      },
    });
  }
}

module.exports = { CssTricksArticleWatcherStack };
