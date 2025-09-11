export interface StyleBlock {
    source: string;
    hash: `ripple-${string}`;
    type: 'StyleSheet';
    body: unknown[]; // TODO
}
