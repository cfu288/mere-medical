const { Octokit } = require('@octokit/action');

const octokit = new Octokit();

(async () => {
  try {
    await octokit.request(
      `POST /repos/cfu288/ansible_inventories/actions/workflows/${process.env.WORKFLOW_ID}/dispatches`,
      {
        ref: 'main',
      }
    );
    console.log('Stage deploy completed');
  } catch (error) {
    console.log('Error when attempting to trigger stage deploy:', error);
    process.exit(1);
  }
})();
