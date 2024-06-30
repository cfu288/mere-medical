(async () => {
  const { Octokit } = await import('@octokit/action');
  const octokit = new Octokit();

  try {
    await octokit.request(
      `POST /repos/cfu288/ansible_inventories/actions/workflows/${process.env.WORKFLOW_ID}/dispatches`,
      {
        ref: 'main',
      },
    );
    console.log('Deploy completed');
  } catch (error) {
    console.log('Error when attempting to trigger deploy:', error);
    process.exit(1);
  }
})();
