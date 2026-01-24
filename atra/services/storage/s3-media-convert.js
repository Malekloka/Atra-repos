const { MediaConvertClient, CreateJobCommand, GetQueueCommand, GetJobCommand } = require("@aws-sdk/client-mediaconvert"); // CommonJS import
const config = require('../../config');

// In local/dev setup we often don't have full MediaConvert configuration or AWS credentials.
// When no config is provided, fall back to a "no-op" implementation so recording doesn't hang.
const hasMediaConvertConfig = !!config.mediaConvert;
const client = hasMediaConvertConfig ? new MediaConvertClient(config.mediaConvert) : null;


const run = async (input) => {
  // Dev / local mode: no MediaConvert config → skip remote conversion so UI doesn't hang.
  if (!hasMediaConvertConfig) {
    console.log('MediaConvert config missing – skipping conversion and returning fake job id.');
    return 'local-dev-job';
  }

  input = input.replace(/https?:\/\/.*\//, 's3://spacecargo/');

  const params = {
    Queue: "arn:aws:mediaconvert:eu-north-1:399405728233:queues/Mp3Queue",
    Role: "arn:aws:iam::399405728233:role/service-role/MediaConvert_Default_Role",
    Settings: {
      Inputs: [
        {
          AudioSelectors: {
            "Audio Selector 1": {
              Offset: 0,
              DefaultSelection: "NOT_DEFAULT",
              ProgramSelection: 1,
              SelectorType: "TRACK",
              Tracks: [1],
            },
          },
          FilterEnable: "AUTO",
          PsiControl: "USE_PSI",
          FilterStrength: 0,
          DeblockFilter: "DISABLED",
          DenoiseFilter: "DISABLED",
          TimecodeSource: "EMBEDDED",
          FileInput: input
          // FileInput: "s3://spacecargo/02b333a3-9e2e-47ce-abb8-d7d6ff48403a-1714045416864.wav", //INPUT_BUCKET_AND_FILENAME, e.g., "s3://BUCKET_NAME/FILE_NAME"
        },
      ],
      "OutputGroups": [
        {
          "Name": "File Group",
          "Outputs": [
            {
              "ContainerSettings": {
                "Container": "RAW"
              },
              "AudioDescriptions": [
                {
                  "AudioSourceName": "Audio Selector 1",
                  "CodecSettings": {
                    "Codec": "MP3",
                    "Mp3Settings": {
                      "RateControlMode": "VBR",
                      "VbrQuality": 3
                    }
                  }
                }
              ]
            }
          ],
          "OutputGroupSettings": {
            "Type": "FILE_GROUP_SETTINGS",
            "FileGroupSettings": {
              "Destination": "s3://spacecargo/"
            }
          }
        }
      ],
    },
  };

  try {
    const data = await client.send(new CreateJobCommand(params));
    return data.Job.Arn;
  } catch (err) {
    console.log("Error", err);
  }
};

async function checkJob (jobId) {
  // Dev / local mode: immediately report job as completed so UI can continue.
  if (!hasMediaConvertConfig) {
    return true;
  }

  const command = new GetJobCommand({
    Id: jobId
  });

  try {
    const data = await client.send(command);
    return data.Job.Status === "COMPLETE";
  } catch (err) {
    console.log("Error", err);
  }
}

module.exports = {
  run,
  checkJob
}
