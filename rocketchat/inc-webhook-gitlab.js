/* eslint no-console:0, max-len:0 */
// see https://gitlab.com/help/web_hooks/web_hooks for full json posted by GitLab
const NOTIF_COLOR = '#6498CC';
const refParser = (ref) => ref.replace(/^refs\/(?:tags|heads)\/(.+)$/, '$1');
const displayName = (name) => name.toLowerCase().replace(/\s+/g, '.');
const atName = (user) => (user && user.name ? '@' + displayName(user.name) : '');
const makeAttachment = (author, text) => {
	return {
		author_name: author ? displayName(author.name) : '',
		author_icon: author ? author.avatar_url : '',
		text,
		color: NOTIF_COLOR
	};
};
const pushUniq = (array, val) => ~array.indexOf(val) || array.push(val); // eslint-disable-line

class Script { // eslint-disable-line
	process_incoming_request({ request }) {
		try {
			let result = null;
			const channel = request.url.query.channel;
			switch (request.headers['x-gitlab-event']) {
				case 'Push Hook':
					result = this.pushEvent(request.content);
					break;
				case 'Merge Request Hook':
					result = this.mergeRequestEvent(request.content);
					break;
				case 'Note Hook':
					result = this.commentEvent(request.content);
					break;
				case 'Issue Hook':
					result = this.issueEvent(request.content);
					break;
				case 'Tag Push Hook':
					result = this.tagEvent(request.content);
					break;
        case 'Pipeline Hook':
					result = this.pipelineEvent(request.content);
					break;
			}
			if (result && result.content && channel) {
				result.content.channel = '#' + channel;
			}
			return result;
		} catch (e) {
			console.log('gitlabevent error', e);
			return {
				error: {
					success: false,
					message: e.message || e
				}
			};
		}
	}

	issueEvent(data) {
		return {
			content: {
				username: 'gitlab/' + data.project.name,
				icon_url: data.project.avatar_url || data.user.avatar_url || '',
				text: (data.assignee && data.assignee.name !== data.user.name) ? atName(data.assignee) : '',
				attachments: [
					makeAttachment(
						data.user,
						`${data.object_attributes.state} an issue _${data.object_attributes.title}_ on ${data.project.name}.
*Description:* ${data.object_attributes.description}.
See: ${data.object_attributes.url}`
					)
				]
			}
		};
	}

	commentEvent(data) {
		const comment = data.object_attributes;
		const user = data.user;
		const at = [];
		let text;
		if (data.merge_request) {
			const mr = data.merge_request;
			const lastCommitAuthor = mr.last_commit && mr.last_commit.author;
			if (mr.assignee && mr.assignee.name !== user.name) {
				at.push(atName(mr.assignee));
			}
			if (lastCommitAuthor && lastCommitAuthor.name !== user.name) {
				pushUniq(at, atName(lastCommitAuthor));
			}
			text = `commented on MR [#${mr.id} ${mr.title}](${comment.url})`;
		} else if (data.commit) {
			const commit = data.commit;
			const message = commit.message.replace(/\n[^\s\S]+/, '...').replace(/\n$/, '');
			if (commit.author && commit.author.name !== user.name) {
				at.push(atName(commit.author));
			}
			text = `commented on commit [${commit.id.slice(0, 8)} ${message}](${comment.url})`;
		} else if (data.issue) {
			const issue = data.issue;
			text = `commented on issue [#${issue.id} ${issue.title}](${comment.url})`;
		} else if (data.snippet) {
			const snippet = data.snippet;
			text = `commented on code snippet [#${snippet.id} ${snippet.title}](${comment.url})`;
		}
		return {
			content: {
				username: 'gitlab/' + data.project.name,
				icon_url: data.project.avatar_url || user.avatar_url || '',
				text: at.join(' '),
				attachments: [
					makeAttachment(user, `${text}\n${comment.note}`)
				]
			}
		};
	}

	mergeRequestEvent(data) {
		const user = data.user;
		const mr = data.object_attributes;
		const assignee = mr.assignee;
		let at = [];

		if (mr.action === 'open' && assignee) {
			at = '\n' + atName(assignee);
		} else if (mr.action === 'merge') {
			const lastCommitAuthor = mr.last_commit && mr.last_commit.author;
			if (assignee && assignee.name !== user.name) {
				at.push(atName(assignee));
			}
			if (lastCommitAuthor && lastCommitAuthor.name !== user.name) {
				pushUniq(at, atName(lastCommitAuthor));
			}
		}
		return {
			content: {
				username: `gitlab/${mr.target.name}`,
				icon_url: mr.target.avatar_url || mr.source.avatar_url || user.avatar_url || '',
				text: at.join(' '),
				attachments: [
					makeAttachment(user, `${mr.action} MR [#${mr.iid} ${mr.title}](${mr.url})\n${mr.source_branch} into ${mr.target_branch}`)
				]
			}
		};
	}

	pushEvent(data) {
		const project = data.project;
		const user = {
			name: data.user_name,
			avatar_url: data.user_avatar
		};
		// branch removal
		if (data.checkout_sha === null && !data.commits.length) {
			return {
				content: {
					username: `gitlab/${project.name}`,
					icon_url: project.avatar_url || data.user_avatar || '',
					attachments: [
						makeAttachment(user, `removed branch ${refParser(data.ref)} from [${project.name}](${project.web_url})`)
					]
				}
			};
		}
		// new branch
		if (data.before == 0) { // eslint-disable-line
			return {
				content: {
					username: `gitlab/${project.name}`,
					icon_url: project.avatar_url || data.user_avatar || '',
					attachments: [
						makeAttachment(user, `pushed new branch [${refParser(data.ref)}](${project.web_url}/commits/${refParser(data.ref)}) to [${project.name}](${project.web_url}), which is ${data.total_commits_count} commits ahead of master`)
					]
				}
			};
		}
		return {
			content: {
				username: `gitlab/${project.name}`,
				icon_url: project.avatar_url || data.user_avatar || '',
				attachments: [
					makeAttachment(user, `pushed ${data.total_commits_count} commits to branch [${refParser(data.ref)}](${project.web_url}/commits/${refParser(data.ref)}) in [${project.name}](${project.web_url})`),
					{
						text: data.commits.map((commit) => `  - ${new Date(commit.timestamp).toUTCString()} [${commit.id.slice(0, 8)}](${commit.url}) by ${commit.author.name}: ${commit.message.replace(/\s*$/, '')}`).join('\n'),
						color: NOTIF_COLOR
					}
				]
			}
		};
	}

	tagEvent(data) {
		const tag = refParser(data.ref);
		return {
			content: {
				username: `gitlab/${data.project.name}`,
				icon_url: data.project.avatar_url || data.user_avatar || '',
				text: '@all',
				attachments: [
					makeAttachment(
						{ name: data.user_name, avatar_url: data.user_avatar },
						`push tag [${tag} ${data.checkout_sha.slice(0, 8)}](${data.project.web_url}/tags/${tag})`
					)
				]
			}
		};
	}

  pipelineEvent(data) {
		const status = data.object_attributes.status;
		const link = data.project.web_url

		return {
			content: {
				username: `gitlab/${data.project.name}`,
				icon_url: data.project.avatar_url || data.user.avatar_url || '',
				text: 'Pipeline Active:',
				attachments: [
					makeAttachment(
						{ name: data.user.name, avatar_url: data.user.avatar_url },
						`Runned a Pipeline with status: ${status} [${data.object_attributes.duration}s] (${data.project.web_url})`
					)
				]
			}
		};
	}
}
